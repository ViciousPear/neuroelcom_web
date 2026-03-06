from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from . import forms, api_client, models
from .utils import handle_uploaded_file, get_component_type, get_category_name, validate_result
import tempfile, os, json, base64
from datetime import datetime
from django.core.files.base import ContentFile
from io import BytesIO
from PIL import Image
from .categories import CategoryManager
from collections import defaultdict
from django.http import HttpResponse
import json
import logging
from django.http import HttpResponse, JsonResponse
from django.template.loader import render_to_string
from django.conf import settings
import pdfkit
from django.utils.safestring import mark_safe
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse
import uuid
from .db_client import DBClient
from collections import defaultdict

logger = logging.getLogger(__name__)

def view_result_by_id(request, result_id):
    """Просмотр конкретного результата по ID"""
    try:
        # Ищем результат
        if request.user.is_authenticated:
            detection_result = get_object_or_404(
                models.DetectionResult, 
                result_id=result_id,
                user=request.user
            )
        else:
            detection_result = get_object_or_404(
                models.DetectionResult,
                result_id=result_id,
                session_key=request.session.session_key
            )
        
        # Проверяем, не старше ли результат месяца
        from django.utils import timezone
        from datetime import timedelta
        
        month_ago = timezone.now() - timedelta(days=30)
        if detection_result.created_at < month_ago:
            messages.warning(request, 'Этот результат старше месяца и будет скоро удален')
        
        # Сохраняем ID в сессии для совместимости
        request.session['last_result_id'] = result_id
        
        # Перенаправляем на стандартную страницу результатов
        return redirect(f'/results/?result_id={result_id}')
        
    except Exception as e:
        messages.error(request, 'Результат не найден')
        return redirect('dashboard')

def results_view(request):
    """Передает данные на страницу results"""
    try:
        # Получаем ID результата из GET параметра или из сессии
        result_id = request.GET.get('result_id') or request.session.get('last_result_id')
        
        if not result_id:
            messages.error(request, 'Результат не найден')
            return redirect('upload')
        
        # Сохраняем ID в сессии для дальнейшего использования
        request.session['last_result_id'] = result_id
        request.session.modified = True
        
        # Получаем ключ сессии
        session_key = request.session.session_key
        
        # Поиск компонентов - сначала по пользователю, потом по сессии
        if request.user.is_authenticated:
            # Для авторизованных пользователей ищем по user
            component_with_image = models.Component.objects.filter(
                result_id=result_id,
                user=request.user
            ).exclude(image__isnull=True).first()
            
            # Если не нашли, пробуем найти в сессии и перенести
            if not component_with_image:
                temp_component = models.Component.objects.filter(
                    result_id=result_id,
                    session_key=session_key
                ).exclude(image__isnull=True).first()
                
                if temp_component:
                    # Переносим все компоненты в аккаунт
                    models.Component.objects.filter(
                        result_id=result_id,
                        session_key=session_key
                    ).update(user=request.user)
                    
                    # Переносим результат
                    models.DetectionResult.objects.filter(
                        result_id=result_id,
                        session_key=session_key
                    ).update(user=request.user)
                    
                    # Обновляем ссылку
                    component_with_image = models.Component.objects.filter(
                        result_id=result_id,
                        user=request.user
                    ).exclude(image__isnull=True).first()
        else:
            # Для гостей ищем по сессии
            component_with_image = models.Component.objects.filter(
                result_id=result_id,
                session_key=session_key
            ).exclude(image__isnull=True).first()
            
            # Проверяем, не истекла ли сессия
            if not component_with_image:
                # Проверяем, есть ли результат в базе, но сессия истекла
                old_result = models.DetectionResult.objects.filter(
                    result_id=result_id
                ).first()
                
                if old_result:
                    messages.warning(
                        request, 
                        'Сессия истекла. Войдите в аккаунт, чтобы восстановить доступ к результатам.'
                    )
                    return redirect('login')
        
        if not component_with_image:
            messages.warning(request, 'Результаты не найдены')
            return redirect('upload')
        
        # Получаем все компоненты
        filter_kwargs = {'result_id': result_id}
        if request.user.is_authenticated:
            filter_kwargs['user'] = request.user
        else:
            filter_kwargs['session_key'] = session_key
        
        all_components = models.Component.objects.filter(
            **filter_kwargs
        ).order_by('component_type', 'group_index', 'id')
        
        components = list(all_components)
        
        # Подготовка данных (весь ваш существующий код подготовки данных)
        cleaned_data = {
            'automatic': [],
            'transformer': [],
            'counter': []
        }
        
        seen_transformers = set()
        seen_counters = set()
        
        for comp in components:
            item = {
                'id': str(comp.article).strip(),
                'name': str(comp.name).strip(),
                'price': float(comp.price),
                'quantity': int(comp.quantity)
            }
            
            if comp.component_type == 'automatic':
                cleaned_data['automatic'].append(item)
            elif comp.component_type == 'transformer':
                if comp.article not in seen_transformers:
                    seen_transformers.add(comp.article)
                    cleaned_data['transformer'].append(item)
            elif comp.component_type == 'counter':
                if comp.article not in seen_counters:
                    seen_counters.add(comp.article)
                    cleaned_data['counter'].append(item)
        
        # Подготовка данных для categories
        categories_data = {}
        
        for comp in components:
            if comp.component_type not in categories_data:
                categories_data[comp.component_type] = {
                    'name': get_category_name(comp.component_type),
                    'groups': defaultdict(list),
                    'is_grouped': comp.component_type == 'automatic',
                }
            
            item_data = {
                'id': comp.article,
                'name': comp.name,
                'price': float(comp.price),
                'group_index': comp.group_index,
                'quantity': comp.quantity
            }
            
            categories_data[comp.component_type]['groups'][comp.group_index].append(item_data)
        
        final_categories = []
        
        for component_type, category in categories_data.items():
            category_groups = []
            
            if category['is_grouped']:
                for group_idx, items in sorted(category['groups'].items()):
                    total_quantity = sum(item.get('quantity', 1) for item in items)
                    manager = CategoryManager(f"Автоматический выключатель {group_idx + 1}")
                    manager.add_item_group(items)
                    prepared_group = manager.prepare_for_template()
                    prepared_group['total_quantity'] = total_quantity
                    category_groups.append(prepared_group)
            else:
                if category['groups']:
                    for group_idx, items in sorted(category['groups'].items()):
                        if items:
                            first_item_quantity = items[0].get('quantity', 1)
                            
                            if component_type == 'transformer':
                                title = f"Трансформатор (x{first_item_quantity})"
                            elif component_type == 'counter':
                                title = f"Счетчик (x{first_item_quantity})"
                            else:
                                title = f"{category['name']} {group_idx + 1}"
                            
                            manager = CategoryManager(title)
                            manager.add_item_group(items)
                            prepared_group = manager.prepare_for_template()
                            prepared_group['actual_quantity'] = first_item_quantity
                            prepared_group['group_count'] = len(category['groups'])
                            category_groups.append(prepared_group)
            
            final_categories.append({
                'name': category['name'],
                'is_grouped': category['is_grouped'],
                'groups': category_groups
            })
        
        # Сериализация данных
        original_data_json = mark_safe(json.dumps(
            cleaned_data,
            ensure_ascii=False,
            indent=None,
            separators=(',', ':')
        ))
        
        context = {
            'categories': final_categories,
            'result_image_url': component_with_image.image.url,
            'original_data_json': original_data_json,
            'result_id': result_id,
            'user': request.user
        }
        
        return render(request, 'recognition/results.html', context)
    
    except Exception as e:
        logger.error(f"Ошибка в results_view: {str(e)}")
        import traceback
        traceback.print_exc()
        return render(request, 'recognition/results.html', {'error': str(e)})

def get_or_create_session_key(request):
    """Получить или создать ключ сессии"""
    if not request.session.session_key:
        request.session.save()
    return request.session.session_key

def get_user_or_session_filter(request):
    """Получить фильтр для запросов в зависимости от авторизации"""
    if request.user.is_authenticated:
        return {'user': request.user}
    else:
        return {'session_key': get_or_create_session_key(request)}

def transfer_session_to_user(request, user):
    """Перенести данные из сессии в пользователя"""
    session_key = request.session.session_key
    if session_key:
        # Переносим DetectionResult
        models.DetectionResult.objects.filter(
            session_key=session_key,
            user__isnull=True
        ).update(user=user)
        
        # Переносим Component
        models.Component.objects.filter(
            session_key=session_key,
            user__isnull=True
        ).update(user=user)
        
        logger.info(f"Данные перенесены из сессии {session_key} в пользователя {user.username}")

def save_result_to_user(request, result_id):
    """Сохранить конкретный результат в аккаунт пользователя"""
    if request.user.is_authenticated:
        try:
            result = models.DetectionResult.objects.get(
                session_key=request.session.session_key,
                result_id=result_id,
                user__isnull=True
            )
            result.user = request.user
            result.save()
            
            # Также переносим связанные компоненты
            models.Component.objects.filter(
                session_key=request.session.session_key,
                result_id=result_id,
                user__isnull=True
            ).update(user=request.user)
            
            return True
        except models.DetectionResult.DoesNotExist:
            return False
    return False

def upload_file(request):
    """Загрузка файла -> распознавание -> промежуточная страница"""
    if request.method == 'POST':
        form = forms.UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                file = request.FILES['file']
                temp_path = handle_uploaded_file(file)
                
                # 1. Распознавание через нейросеть
                api = api_client.APIClient()
                api_response = api.detect_only(temp_path)
                
                # 2. Генерация уникального ID
                result_id = str(uuid.uuid4())
                
                # 3. Получаем или создаем ключ сессии
                session_key = get_or_create_session_key(request)
                
                # 4. Сохраняем данные
                detected_data = api_response['detection_results']
                image_base64 = api_response['image_base64']
                
                # Нормализуем изображение перед сохранением
                if isinstance(image_base64, str):
                    image_base64 = image_base64.strip()
                    if not image_base64.startswith('data:image'):
                        image_base64 = f"data:image/jpeg;base64,{image_base64}"
                else:
                    try:
                        image_base64 = str(image_base64)
                        image_base64 = f"data:image/jpeg;base64,{image_base64}"
                    except:
                        image_base64 = ""
                
                # Создаем результат с учетом авторизации
                detection_result = models.DetectionResult(
                    user=request.user if request.user.is_authenticated else None,
                    session_key=session_key,
                    result_id=result_id,
                    image_base64=image_base64,
                    detected_data=detected_data,
                    is_edited=False,
                    name=f"Результат от {datetime.now().strftime('%d.%m.%Y %H:%M')}"
                )
                detection_result.save()
                
                # 5. Сохраняем ID в сессии
                request.session['edit_result_id'] = result_id
                request.session.modified = True
                
                # Сообщение для авторизованных пользователей
                if request.user.is_authenticated:
                    messages.success(request, 'Результат сохранен в ваш аккаунт')
                
                return redirect('edit_results')
                    
            except Exception as e:
                logger.error(f"Ошибка обработки: {str(e)}")
                import traceback
                traceback.print_exc()
                return render(request, 'recognition/upload.html', {
                    'form': form,
                    'error': f"Ошибка обработки: {str(e)}"
                })
    
    return render(request, 'recognition/upload.html', {'form': forms.UploadFileForm()})


def edit_results_view(request):
    """Промежуточная страница редактирования"""
    result_id = request.session.get('edit_result_id')
    
    if not result_id:
        messages.error(request, 'Сессия истекла. Пожалуйста, загрузите файл заново.')
        return redirect('upload')
    
    try:
        # Пытаемся найти результат сначала по пользователю, потом по сессии
        filter_kwargs = {'result_id': result_id}
        if request.user.is_authenticated:
            filter_kwargs['user'] = request.user
        else:
            filter_kwargs['session_key'] = get_or_create_session_key(request)
        
        detection_result = models.DetectionResult.objects.get(**filter_kwargs)
        
        # ПРЕОБРАЗОВАНИЕ ДАННЫХ
        detected_data = []
        
        if detection_result.detected_data:
            if isinstance(detection_result.detected_data, list):
                transformer_count = 0
                
                for item in detection_result.detected_data:
                    if isinstance(item, dict):
                        element_type = item.get('type', 'QF')
                        parameters = item.get('parameters', {})
                        
                        if element_type == 'QF':
                            formatted_params = {
                                'name': parameters.get('name', ''),  
                                'current': parameters.get('current') or '',
                                'voltage': parameters.get('voltage') or '',
                                'current_close': parameters.get('current_close') or '',
                                'mounting_type': parameters.get('mounting_type') or '',
                                'polus': parameters.get('polus') or '',
                                'id_qf': parameters.get('id_qf') or ''
                            }
                            detected_data.append({
                                'type': element_type,
                                'parameters': formatted_params
                            })
                            
                        elif element_type == 'transformer':
                            transformer_count += 1
                            quantity = parameters.get('quantity', 1)
                            if isinstance(quantity, str):
                                try:
                                    quantity = int(quantity)
                                except:
                                    quantity = 1
                            
                            detected_data.append({
                                'type': element_type,
                                'parameters': {'quantity': quantity}
                            })
                            
                        elif element_type == 'counter':
                            quantity = parameters.get('quantity', 1)
                            if isinstance(quantity, str):
                                try:
                                    quantity = int(quantity)
                                except:
                                    quantity = 1
                            detected_data.append({
                                'type': element_type,
                                'parameters': {'quantity': quantity}
                            })
        
        # Обработка изображения
        image_base64 = detection_result.image_base64
        image_base64 = image_base64.strip()
        
        if not image_base64.startswith('data:image'):
            if 'base64,' in image_base64:
                parts = image_base64.split('base64,')
                if len(parts) > 1:
                    image_base64 = f"data:image/jpeg;base64,{parts[1]}"
            else:
                image_base64 = f"data:image/jpeg;base64,{image_base64}"
        
        context = {
            'result_id': result_id,
            'image_base64': image_base64,
            'detected_data': json.dumps(detected_data, ensure_ascii=False),
            'element_types': {
                'QF': 'Автоматический выключатель',
                'transformer': 'Трансформатор',
                'counter': 'Счетчик'
            },
            'user': request.user  # Передаем пользователя в шаблон
        }
        
        return render(request, 'recognition/edit_results.html', context)
        
    except models.DetectionResult.DoesNotExist:
        messages.error(request, 'Результат не найден')
        return redirect('upload')


@csrf_exempt
def save_edited_results(request):
    """Сохранение отредактированных результатов"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            result_id = data.get('result_id')
            edited_data = data.get('edited_data')
            
            # Поиск результата
            filter_kwargs = {'result_id': result_id}
            if request.user.is_authenticated:
                filter_kwargs['user'] = request.user
            else:
                filter_kwargs['session_key'] = get_or_create_session_key(request)
            
            detection_result = models.DetectionResult.objects.get(**filter_kwargs)
            
            detection_result.edited_data = edited_data
            detection_result.is_edited = True
            detection_result.save()
            
            # Сохраняем ID для страницы результатов
            request.session['search_result_id'] = result_id
            request.session.modified = True
            
            return JsonResponse({'success': True, 'redirect_url': '/results/'})
            
        except models.DetectionResult.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Результат не найден'}, status=404)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=500)
    
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)


def process_edited_data(request):
    """AJAX обработка отредактированных данных и поиск в БД"""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            result_id = data.get('result_id')
            edited_elements = data.get('edited_elements', [])
            
            if not result_id or not edited_elements:
                return JsonResponse({
                    'success': False,
                    'error': 'Отсутствуют обязательные данные'
                }, status=400)
            
            # Поиск результата
            filter_kwargs = {'result_id': result_id}
            if request.user.is_authenticated:
                filter_kwargs['user'] = request.user
            else:
                filter_kwargs['session_key'] = get_or_create_session_key(request)
            
            try:
                detection_result = models.DetectionResult.objects.get(**filter_kwargs)
            except models.DetectionResult.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': 'Результат не найден'
                }, status=404)
            
            # Инициализация клиента БД
            db_client = DBClient()
            
            # Массив для хранения всех результатов поиска
            all_search_results = []
            total_results = 0
            
            # Группируем элементы по типу
            qf_elements = [e for e in edited_elements if e.get('type') == 'QF']
            transformer_elements = [e for e in edited_elements if e.get('type') == 'transformer']
            counter_elements = [e for e in edited_elements if e.get('type') == 'counter']
            
            # 1. Обработка автоматических выключателей
            for qf_idx, qf_element in enumerate(qf_elements):
                try:
                    params = qf_element.get('parameters', {})
                    results = db_client.search_breakers(params)
                    
                    all_search_results.append({
                        'type': 'QF',
                        'original_element': qf_element,
                        'search_results': results,
                        'result_count': len(results),
                        'group_index': qf_idx,
                        'total_quantity': 1
                    })
                    total_results += len(results)
                    
                except Exception as e:
                    logger.error(f"Ошибка поиска выключателей: {str(e)}")
                    all_search_results.append({
                        'type': 'QF',
                        'original_element': qf_element,
                        'search_results': [],
                        'error': str(e),
                        'group_index': qf_idx,
                        'total_quantity': 1
                    })
            
            # 2. Обработка трансформаторов
            if transformer_elements:
                try:
                    total_quantity = 0
                    for transformer_element in transformer_elements:
                        params = transformer_element.get('parameters', {})
                        quantity = params.get('quantity', 1)
                        if isinstance(quantity, str) and quantity.isdigit():
                            quantity = int(quantity)
                        elif isinstance(quantity, int):
                            quantity = quantity
                        else:
                            quantity = 1
                        total_quantity += quantity
                    
                    if transformer_elements:
                        first_element = transformer_elements[0]
                        first_params = first_element.get('parameters', {})
                        results = db_client.search_transformators(first_params)
                        
                        processed_results = []
                        if results:
                            for result in results:
                                result_copy = result.copy() if isinstance(result, dict) else {}
                                result_copy['quantity'] = total_quantity
                                result_copy['total_price'] = float(result_copy.get('price', 0)) * total_quantity
                                processed_results.append(result_copy)
                        
                        all_search_results.append({
                            'type': 'transformer',
                            'original_element': {
                                'type': 'transformer',
                                'parameters': {'quantity': total_quantity}
                            },
                            'search_results': processed_results,
                            'result_count': len(processed_results),
                            'total_quantity': total_quantity,
                            'group_index': len(qf_elements)
                        })
                        total_results += len(processed_results)
                    
                except Exception as e:
                    logger.error(f"Ошибка поиска трансформаторов: {str(e)}")
                    all_search_results.append({
                        'type': 'transformer',
                        'original_element': {'type': 'transformer', 'parameters': {}},
                        'search_results': [],
                        'error': str(e),
                        'group_index': len(qf_elements),
                        'total_quantity': 0
                    })
            
            # 3. Обработка счетчиков
            if counter_elements:
                try:
                    total_quantity = 0
                    for counter_element in counter_elements:
                        params = counter_element.get('parameters', {})
                        quantity = params.get('quantity', 1)
                        if isinstance(quantity, str) and quantity.isdigit():
                            quantity = int(quantity)
                        elif isinstance(quantity, int):
                            quantity = quantity
                        else:
                            quantity = 1
                        total_quantity += quantity
                    
                    if counter_elements:
                        first_element = counter_elements[0]
                        first_params = first_element.get('parameters', {})
                        results = db_client.search_counters(first_params)
                        
                        processed_results = []
                        if results:
                            for result in results:
                                result_copy = result.copy() if isinstance(result, dict) else {}
                                result_copy['quantity'] = total_quantity
                                result_copy['total_price'] = float(result_copy.get('price', 0)) * total_quantity
                                processed_results.append(result_copy)
                        
                        all_search_results.append({
                            'type': 'counter',
                            'original_element': {
                                'type': 'counter',
                                'parameters': {'quantity': total_quantity}
                            },
                            'search_results': processed_results,
                            'result_count': len(processed_results),
                            'total_quantity': total_quantity,
                            'group_index': len(qf_elements) + (1 if transformer_elements else 0)
                        })
                        total_results += len(processed_results)
                    
                except Exception as e:
                    logger.error(f"Ошибка поиска счетчиков: {str(e)}")
                    all_search_results.append({
                        'type': 'counter',
                        'original_element': {'type': 'counter', 'parameters': {}},
                        'search_results': [],
                        'error': str(e),
                        'group_index': len(qf_elements) + (1 if transformer_elements else 0),
                        'total_quantity': 0
                    })
            
            # Сохраняем в DetectionResult
            detection_result.edited_data = edited_elements
            detection_result.search_results = all_search_results
            detection_result.is_edited = True
            detection_result.save()
            
            # Сохраняем найденные товары в Component
            _save_search_results_to_components(
                session_key=request.session.session_key,
                user=request.user if request.user.is_authenticated else None,
                result_id=result_id,
                search_results=all_search_results,
                image_base64=detection_result.image_base64
            )
            
            # Сохраняем ID для страницы results
            request.session['last_result_id'] = result_id
            request.session.modified = True
            
            # Если пользователь авторизован, показываем сообщение
            if request.user.is_authenticated:
                messages.success(request, 'Результаты успешно сохранены в ваш аккаунт')
            
            return JsonResponse({
                'success': True,
                'redirect_url': '/results/',
                'total_elements': len(edited_elements),
                'total_results': total_results,
                'result_id': result_id,
                'transformer_total': sum(1 for e in transformer_elements),
                'transformer_quantity': total_quantity if transformer_elements else 0,
                'counter_total': sum(1 for e in counter_elements),
                'counter_quantity': total_quantity if counter_elements else 0
            })
            
        except Exception as e:
            logger.error(f"Ошибка обработки отредактированных данных: {str(e)}")
            import traceback
            traceback.print_exc()
            return JsonResponse({
                'success': False,
                'error': f'Ошибка сервера: {str(e)}'
            }, status=500)
    
    return JsonResponse({'success': False, 'error': 'Метод не поддерживается'}, status=405)


def _save_search_results_to_components(session_key, user, result_id, search_results, image_base64):
    """Сохраняет результаты поиска в модель Component с сохранением группировки"""
    try:
        # Удаляем старые компоненты
        filter_kwargs = {'result_id': result_id}
        if user:
            filter_kwargs['user'] = user
        else:
            filter_kwargs['session_key'] = session_key
        
        models.Component.objects.filter(**filter_kwargs).delete()
        
        component_count = 0
        
        # Проходим по каждой группе результатов
        for result_group in search_results:
            element_type = result_group.get('type', 'QF')
            search_results_list = result_group.get('search_results', [])
            group_index = result_group.get('group_index', 0)
            total_quantity = result_group.get('total_quantity', 1)
            
            # Преобразуем тип в формат Component
            component_type = _map_element_type_to_component_type(element_type)
            
            for idx, search_result in enumerate(search_results_list):
                try:
                    article = search_result.get('article', '') or search_result.get('id', '')
                    name = search_result.get('name', '') or search_result.get('description', '')
                    
                    # Обработка цены
                    price = search_result.get('price', 0)
                    try:
                        if isinstance(price, str):
                            import re
                            price_str = re.sub(r'[^\d.,]', '', price)
                            price_str = price_str.replace(',', '.')
                            price = float(price_str) if price_str else 0.0
                        else:
                            price = float(price)
                    except:
                        price = 0.0
                    
                    # Определяем количество и итоговую цену
                    if element_type in ['transformer', 'counter']:
                        quantity = total_quantity
                        if 'total_price' in search_result:
                            try:
                                price = float(search_result['total_price'])
                            except:
                                price = price * quantity
                        else:
                            price = price * quantity
                    else:
                        quantity = search_result.get('quantity', 1)
                        if isinstance(quantity, str):
                            try:
                                quantity = int(quantity)
                            except:
                                quantity = 1
                    
                    component = models.Component(
                        user=user,
                        component_type=component_type,
                        article=article or f'RES_{element_type}_{group_index}_{idx}',
                        name=name or 'Неизвестно',
                        price=price,
                        object_id=f"{group_index+1}_{idx+1}",
                        group_index=group_index,
                        session_key=session_key,
                        result_id=result_id,
                        quantity=quantity
                    )
                    
                    # Сохраняем изображение для первого компонента
                    if component_count == 0 and image_base64:
                        try:
                            if isinstance(image_base64, str) and 'base64,' in image_base64:
                                image_base64 = image_base64.split('base64,')[1]
                            
                            image_data = base64.b64decode(image_base64)
                            image = Image.open(BytesIO(image_data))
                            image_io = BytesIO()
                            image.save(image_io, format='PNG')
                            
                            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                            image_name = f"result_{result_id}_{timestamp}.png"
                            image_content = ContentFile(image_io.getvalue(), name=image_name)
                            
                            component.image.save(image_name, image_content)
                        except Exception as img_error:
                            logger.warning(f"Не удалось сохранить изображение: {img_error}")
                    
                    component.save()
                    component_count += 1
                    
                except Exception as e:
                    logger.error(f"Ошибка сохранения компонента: {e}")
                    continue
        
        logger.info(f"Сохранено {component_count} компонентов для result_id: {result_id}")
        return component_count > 0
        
    except Exception as e:
        logger.error(f"Ошибка сохранения результатов поиска: {e}")
        return False


def _map_element_type_to_component_type(element_type):
    """Сопоставляет тип элемента с типом компонента"""
    type_mapping = {
        'QF': 'automatic',
        'transformer': 'transformer',
        'counter': 'counter'
    }
    return type_mapping.get(element_type, 'automatic')


def show_search_results(request):
    """Отображение результатов поиска в БД"""
    result_id = request.session.get('search_result_id')
    
    if not result_id:
        messages.error(request, 'Сессия истекла')
        return redirect('edit_results')
    
    try:
        # Поиск результата
        filter_kwargs = {'result_id': result_id}
        if request.user.is_authenticated:
            filter_kwargs['user'] = request.user
        else:
            filter_kwargs['session_key'] = get_or_create_session_key(request)
        
        detection_result = models.DetectionResult.objects.get(**filter_kwargs)
        
        context = {
            'result_id': result_id,
            'image_base64': detection_result.image_base64,
            'edited_elements': detection_result.edited_data or [],
            'search_results': detection_result.search_results or [],
            'total_elements': len(detection_result.edited_data or []),
            'total_search_results': sum(
                len(group.get('search_results', [])) 
                for group in (detection_result.search_results or [])
            ),
            'user': request.user
        }
        
        return render(request, 'recognition/search_results.html', context)
        
    except models.DetectionResult.DoesNotExist:
        messages.error(request, 'Результат не найден')
        return redirect('edit_results')
    except Exception as e:
        logger.error(f"Ошибка отображения результатов: {str(e)}")
        return render(request, 'recognition/error.html', {'error': str(e)})


def results_view(request):
    """Передает данные на страницу results"""
    try:
        result_id = request.session.get('last_result_id')
        
        if not result_id:
            messages.error(request, 'Сессия истекла')
            return redirect('upload')
        
        # Получаем ключ сессии
        session_key = get_or_create_session_key(request)
        
        # Поиск компонентов
        filter_kwargs = {'result_id': result_id}
        if request.user.is_authenticated:
            filter_kwargs['user'] = request.user
        else:
            filter_kwargs['session_key'] = session_key
        
        component_with_image = models.Component.objects.filter(
            **filter_kwargs
        ).exclude(image__isnull=True).first()
        
        if not component_with_image:
            messages.warning(request, 'Результаты не найдены')
            return redirect('upload')
        
        # Получаем все компоненты
        all_components = models.Component.objects.filter(
            **filter_kwargs
        ).order_by('component_type', 'group_index', 'id')
        
        components = list(all_components)
        
        # Подготовка данных
        cleaned_data = {
            'automatic': [],
            'transformer': [],
            'counter': []
        }
        
        seen_transformers = set()
        seen_counters = set()
        
        for comp in components:
            item = {
                'id': str(comp.article).strip(),
                'name': str(comp.name).strip(),
                'price': float(comp.price),
                'quantity': int(comp.quantity)
            }
            
            if comp.component_type == 'automatic':
                cleaned_data['automatic'].append(item)
            elif comp.component_type == 'transformer':
                if comp.article not in seen_transformers:
                    seen_transformers.add(comp.article)
                    cleaned_data['transformer'].append(item)
            elif comp.component_type == 'counter':
                if comp.article not in seen_counters:
                    seen_counters.add(comp.article)
                    cleaned_data['counter'].append(item)
        
        # Подготовка данных для categories
        categories_data = {}
        
        for comp in components:
            if comp.component_type not in categories_data:
                categories_data[comp.component_type] = {
                    'name': get_category_name(comp.component_type),
                    'groups': defaultdict(list),
                    'is_grouped': comp.component_type == 'automatic',
                }
            
            item_data = {
                'id': comp.article,
                'name': comp.name,
                'price': float(comp.price),
                'group_index': comp.group_index,
                'quantity': comp.quantity
            }
            
            categories_data[comp.component_type]['groups'][comp.group_index].append(item_data)
        
        final_categories = []
        
        for component_type, category in categories_data.items():
            category_groups = []
            
            if category['is_grouped']:
                for group_idx, items in sorted(category['groups'].items()):
                    total_quantity = sum(item.get('quantity', 1) for item in items)
                    manager = CategoryManager(f"Автоматический выключатель {group_idx + 1}")
                    manager.add_item_group(items)
                    prepared_group = manager.prepare_for_template()
                    prepared_group['total_quantity'] = total_quantity
                    category_groups.append(prepared_group)
            else:
                if category['groups']:
                    for group_idx, items in sorted(category['groups'].items()):
                        if items:
                            first_item_quantity = items[0].get('quantity', 1)
                            
                            if component_type == 'transformer':
                                title = f"Трансформатор (x{first_item_quantity})"
                            elif component_type == 'counter':
                                title = f"Счетчик (x{first_item_quantity})"
                            else:
                                title = f"{category['name']} {group_idx + 1}"
                            
                            manager = CategoryManager(title)
                            manager.add_item_group(items)
                            prepared_group = manager.prepare_for_template()
                            prepared_group['actual_quantity'] = first_item_quantity
                            prepared_group['group_count'] = len(category['groups'])
                            category_groups.append(prepared_group)
            
            final_categories.append({
                'name': category['name'],
                'is_grouped': category['is_grouped'],
                'groups': category_groups
            })
        
        # Сериализация данных
        original_data_json = mark_safe(json.dumps(
            cleaned_data,
            ensure_ascii=False,
            indent=None,
            separators=(',', ':')
        ))
        
        context = {
            'categories': final_categories,
            'result_image_url': component_with_image.image.url,
            'original_data_json': original_data_json,
            'result_id': result_id,
            'user': request.user
        }
        
        return render(request, 'recognition/results.html', context)
    
    except Exception as e:
        logger.error(f"Ошибка в results_view: {str(e)}")
        import traceback
        traceback.print_exc()
        return render(request, 'recognition/results.html', {'error': str(e)})


@login_required
def save_result_to_account(request, result_id):
    """Сохранить результат из сессии в аккаунт"""
    if save_result_to_user(request, result_id):
        messages.success(request, 'Результат успешно сохранен в ваш аккаунт')
    else:
        messages.error(request, 'Не удалось сохранить результат')
    
    return redirect('results_view')


@login_required
def my_results_list(request):
    """Список всех результатов пользователя"""
    results = models.DetectionResult.objects.filter(
        user=request.user
    ).order_by('-created_at')
    
    # Статистика
    total_results = results.count()
    favorite_results = results.filter(is_favorite=True).count()
    edited_results = results.filter(is_edited=True).count()
    
    context = {
        'results': results[:20],  # Последние 20
        'total_results': total_results,
        'favorite_results': favorite_results,
        'edited_results': edited_results,
    }
    return render(request, 'recognition/my_results.html', context)


@login_required
def toggle_favorite(request, result_id):
    """Добавить/убрать результат из избранного"""
    if request.method == 'POST':
        try:
            result = models.DetectionResult.objects.get(
                user=request.user,
                result_id=result_id
            )
            result.is_favorite = not result.is_favorite
            result.save()
            
            return JsonResponse({
                'success': True,
                'is_favorite': result.is_favorite
            })
        except models.DetectionResult.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Результат не найден'}, status=404)
    
    return JsonResponse({'success': False, 'error': 'Invalid method'}, status=405)


@login_required
def delete_result(request, result_id):
    """Удалить результат"""
    try:
        result = models.DetectionResult.objects.get(
            user=request.user,
            result_id=result_id
        )
        # Удаляем связанные компоненты
        models.Component.objects.filter(
            user=request.user,
            result_id=result_id
        ).delete()
        result.delete()
        messages.success(request, 'Результат успешно удален')
    except models.DetectionResult.DoesNotExist:
        messages.error(request, 'Результат не найден')
    
    return redirect('my_results')


@csrf_exempt
def api_check_results_access(request):
    """API для проверки доступа к результатам"""
    has_access = False
    
    if request.user.is_authenticated:
        has_access = True
    elif request.session.session_key:
        # Проверяем, есть ли результаты в сессии
        result_id = request.session.get('last_result_id')
        if result_id:
            has_access = models.DetectionResult.objects.filter(
                session_key=request.session.session_key,
                result_id=result_id
            ).exists()
    
    return JsonResponse({
        'has_access': has_access,
        'is_authenticated': request.user.is_authenticated,
        'result_id': request.session.get('last_result_id')
    })


@csrf_exempt
def process_pdf(request):
    """Обрабатывает PDF в изображение для НОВОЙ архитектуры"""
    if request.method != 'POST':
        logger.error("Method not allowed")
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        session_key = get_or_create_session_key(request)
        logger.info(f"Received file from session {session_key}")
        
        if 'image' not in request.FILES:
            logger.error("No image provided")
            return JsonResponse({'error': 'No image provided'}, status=400)
        
        temp_path = handle_uploaded_file(request.FILES['image'])
        logger.info(f"File saved to: {temp_path}")
        
        api = api_client.APIClient()
        api_response = api.detect_only(temp_path)
        logger.info("API response received")
        
        result_id = str(uuid.uuid4())
        
        # Сохраняем результат
        detection_result = models.DetectionResult(
            user=request.user if request.user.is_authenticated else None,
            session_key=session_key,
            result_id=result_id,
            image_base64=api_response['image_base64'],
            detected_data=api_response['detection_results'],
            is_edited=False,
            name=f"Результат от {datetime.now().strftime('%d.%m.%Y %H:%M')}"
        )
        detection_result.save()
        
        request.session['edit_result_id'] = result_id
        request.session.modified = True
        
        # Удаление временного файла
        try:
            os.unlink(temp_path)
            logger.info("Temporary file deleted")
        except Exception as e:
            logger.warning(f"Could not delete temp file: {str(e)}")
        
        return JsonResponse({
            'redirect_url': reverse('edit_results'),
            'is_new': True
        })
        
    except Exception as e:
        logger.exception("Error in process_pdf")
        return JsonResponse({
            'error': 'server_error',
            'message': f'Ошибка обработки: {str(e)}'
        }, status=500)

def create_pdf(request):
    """Рендерит страницу и созданиет файл PDF"""
    
    if request.method == 'POST':
        try:
            # Логирование начала обработки
            logger.info("Начало генерации PDF")
            
            # Проверка и логирование данных запроса
            try:
                data = json.loads(request.body.decode('utf-8'))
                logger.debug(f"Получены данные: {json.dumps(data, indent=2, ensure_ascii=False)}")
            except Exception as e:
                logger.error(f"Ошибка парсинга JSON: {str(e)}")
                return JsonResponse(
                    {'error': 'Invalid JSON data'}, 
                    status=400
                )

            # Проверка наличия обязательных полей
            if 'categories' not in data:
                logger.error("Отсутствует поле 'categories' в данных")
                return JsonResponse(
                    {'error': 'Missing categories field'},
                    status=400
                )
            categories = data.get('categories', [])
            item_counter = 1  # Общий счетчик элементов
            
            for category in categories:
                elements = category.get('elements', [])
                for element in elements:
                    element['number'] = item_counter
                    item_counter += 1

            # Получение абсолютного пути к шрифту
            static_dir = os.path.join(settings.BASE_DIR, 'static')
            font_path = os.path.join(static_dir, 'font', 'manrope-regular.ttf')
            
            # Дополнительная проверка пути для Windows
            font_path = os.path.abspath(font_path).replace('\\', '/')
            
            if not os.path.exists(font_path):
                logger.error(f"Файл шрифта не найден: {font_path}")
                return JsonResponse({'error': 'Font file not found'}, status=500)

            #  Использование base64 для шрифта
            with open(font_path, 'rb') as font_file:
                font_base64 = base64.b64encode(font_file.read()).decode('utf-8')

            # Чтение логотипа
            logo_path = os.path.join(static_dir, 'images', 'logo_for_contacts.png')
            logo_path = os.path.abspath(logo_path).replace('\\', '/')
            logo_base64 = None
            if os.path.exists(logo_path):
                with open(logo_path, 'rb') as logo_file:
                    logo_base64 = base64.b64encode(logo_file.read()).decode('utf-8')

            engineer_path = os.path.join(static_dir, 'images', 'kononuchenko_dmitriy.jpeg')
            engineer_path = os.path.abspath(engineer_path).replace('\\', '/')
            engineer_image_base64 = None
            if os.path.exists(engineer_path):
                with open(engineer_path, 'rb') as engineer_image_file:
                    engineer_image_base64 = base64.b64encode(engineer_image_file.read()).decode('utf-8')

            manager_path = os.path.join(static_dir, 'images', 'petrova_antonina.jpg')
            manager_path = os.path.abspath(manager_path).replace('\\', '/')
            manager_image_base64 = None
            if os.path.exists(manager_path):
                with open(manager_path, 'rb') as manager_image_file:
                    manager_image_base64 = base64.b64encode(manager_image_file.read()).decode('utf-8')
            
            # Рендеринг HTML
            html = render_to_string('recognition/pdf_template.html', {
                'data': data,
                'FONT_BASE64': font_base64,
                'LOGO_BASE64': logo_base64,
                'ENGINEER_BASE64': engineer_image_base64,
                'MANAGER_BASE64': manager_image_base64
            })

            # Настройки для PDFKit
            options = {
                'encoding': 'UTF-8',
                'quiet': '',
                'enable-local-file-access': None,
                'no-stop-slow-scripts': '',
                'load-error-handling': 'ignore',
                'margin-top': '15mm',
                'margin-bottom': '15mm',
                'margin-left': '10mm',
                'margin-right': '10mm',
                'dpi': 300,
                'image-quality': 100,
            }

            # Для Windows обязательно указывание пути к wkhtmltopdf
            config = pdfkit.configuration(
                wkhtmltopdf=r'C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe'
                #wkhtmltopdf=r"/usr/local/bin/wkhtmltopdf" " - для хостинга beget
            )

            try:
                # Прямое создание PDF из HTML
                pdf_buffer = pdfkit.from_string(
                    html,
                    False,
                    options=options,
                    configuration=config
                )
                
                # Вариант 2: Сохранение во временный файл (для дебага)
                # import tempfile
                # with tempfile.NamedTemporaryFile(suffix='.html', delete=False) as tmp_html:
                #     tmp_html.write(html.encode('utf-8'))
                #     tmp_html_path = tmp_html.name
                # 
                # with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
                #     pdfkit.from_file(tmp_html_path, tmp_pdf.name, options=options, configuration=config)
                #     with open(tmp_pdf.name, 'rb') as f:
                #         pdf_buffer = f.read()
                # 
                # os.unlink(tmp_html_path)
                # os.unlink(tmp_pdf.name)

                response = HttpResponse(pdf_buffer, content_type='application/pdf')
                response['Content-Disposition'] = 'attachment; filename="recognition_results.pdf"'
                return response

            except Exception as e:
                logger.error(f"Ошибка при создании PDF: {str(e)}")
                return JsonResponse({'error': 'PDF creation error'}, status=500)

        except Exception as e:
            logger.exception("Непредвиденная ошибка при генерации PDF")
            return JsonResponse({'error': 'Internal server error'}, status=500)
    
    return JsonResponse({'error': 'Method not allowed'}, status=405)