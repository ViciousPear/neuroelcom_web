from django.shortcuts import render, redirect
from . import forms, api_client, models
from .utils import handle_uploaded_file, get_component_type, get_category_name
import tempfile, os, json, base64
from datetime import datetime
from django.core.files.base import ContentFile
from io import BytesIO
from PIL import Image
from .categories import CategoryManager
from collections import defaultdict
from django.http import HttpResponse
# from xhtml2pdf import pisa
import json
import logging
from django.http import HttpResponse, JsonResponse
from django.template.loader import render_to_string
from django.conf import settings
import pdfkit
from django.utils.safestring import mark_safe
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.urls import reverse

logger = logging.getLogger(__name__)


def upload_file(request):
    """Принимает изображение со страницы upload и отправляет на страницу results"""
    if request.method == 'POST':
        form = forms.UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            try:
                file = request.FILES['file']
                temp_path = handle_uploaded_file(file)
                
                api = api_client.APIClient()
                api_response = api.detect_image(temp_path)
                
                if not isinstance(api_response, dict) or 'image_base64' not in api_response or 'detection_results' not in api_response:
                    raise ValueError("Неверный формат ответа API")
                
                # Сохранение и получение пути к изображению
                success, image_path = save_detection_results(
                    api_response['detection_results'], 
                    api_response['image_base64']
                )
                
                if success:
                    return redirect('results')
                else:
                    raise Exception("Не удалось сохранить результаты")
                    
            except Exception as e:
                return render(request, 'recognition/upload.html', {
                    'form': form,
                    'error': f"Ошибка обработки: {str(e)}"
                })
    
    return render(request, 'recognition/upload.html', {'form': forms.UploadFileForm()})

def save_detection_results(results, image_base64):
    """Сохраняет результаты и возвращает (success, image_path)"""
    if not results or not isinstance(results, list):
        return False, None
    
    models.Component.objects.all().delete()
    saved_count = 0
    image_path = None
    
    try:
        # Обработка изображения
        if isinstance(image_base64, str) and 'base64,' in image_base64:
            image_base64 = image_base64.split('base64,')[1]
        
        image_data = base64.b64decode(image_base64)
        image = Image.open(BytesIO(image_data))
        image_io = BytesIO()
        image.save(image_io, format='PNG')
        
        # Генерация уникального имени файла
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        image_name = f"result_{timestamp}.png"
        image_content = ContentFile(image_io.getvalue(), name=image_name)
        
        # Обработка результатов
        for category_idx, category in enumerate(results):
            if not isinstance(category, list):
                continue
                
            for group_idx, group in enumerate(category):
                if not isinstance(group, list):
                    continue
                    
                for item_idx, item in enumerate(group):
                    try:
                        component_type = get_component_type(str(item.get('id', '')))
                        object_id = f"{category_idx+1}_{group_idx+1}"
                        
                        component = models.Component(
                            component_type=component_type,
                            article=item.get('id', ''),
                            name=item.get('name', ''),
                            price=float(item.get('price', 0)),
                            object_id=object_id,
                            group_index=group_idx
                        )
                        
                        # Сохранение изображения только для первого компонента
                        if saved_count == 0:
                            component.image.save(image_name, image_content)
                            image_path = component.image.url
                        
                        component.save()
                        saved_count += 1
                    except Exception as e:
                        print(f"Ошибка сохранения: {str(e)}")
                        continue
        
        return saved_count > 0, image_path
    except Exception as e:
        print(f"Ошибка при сохранении результатов: {str(e)}")
        return False, None

def results_view(request):
    """Передает данные на страницу results"""
    try:
        component_with_image = models.Component.objects.exclude(image__isnull=True).first()
        
        if not component_with_image:
            raise ValueError("Нет данных с изображениями в базе")

        components = models.Component.objects.all().order_by('component_type', 'group_index')
        
        # Получение исходных данных из базы (предполагая, что они сохранены)
        # Или создаение структуры на основе компонентов
        original_data = defaultdict(list)
        for comp in components:
            original_data[comp.component_type].append({
                'id': comp.article,
                'name': comp.name,
                'price': float(comp.price),
                'group_index': comp.group_index
            })

        categories_data = {}
        
        for comp in components:
            if comp.component_type not in categories_data:
                categories_data[comp.component_type] = {
                    'name': get_category_name(comp.component_type),
                    'groups': defaultdict(list),
                    # Флаг для группировки
                    'is_grouped': comp.component_type == 'automatic',
                    # Добавление исходных данных  
                    'original_data': original_data.get(comp.component_type, [])  
                }
            
            item_data = {
                'id': comp.article,
                'name': comp.name,
                'price': float(comp.price),
                'group_index': comp.group_index
            }
            
            categories_data[comp.component_type]['groups'][comp.group_index].append(item_data)

        final_categories = []
        
        for component_type, category in categories_data.items():
            category_groups = []
            
            if category['is_grouped']:
                for group_idx, items in sorted(category['groups'].items()):
                    manager = CategoryManager(f"Элемент {group_idx + 1}")
                    manager.add_item_group(items)
                    prepared_group = manager.prepare_for_template()
                    # Добавление исходных данных в группу
                    prepared_group['original_data'] = category['original_data']  
                    category_groups.append(prepared_group)
            else:
                if category['groups']:
                    first_group_idx, first_group_items = next(iter(sorted(category['groups'].items())))
                    manager = CategoryManager(category['name'])
                    manager.add_item_group(first_group_items)
                    prepared_group = manager.prepare_for_template()
                    prepared_group['group_count'] = len(category['groups'])
                    # Добавление исходных данных
                    prepared_group['original_data'] = category['original_data']  
                    category_groups.append(prepared_group)
            
            final_categories.append({
                'name': category['name'],
                'is_grouped': category['is_grouped'],
                'groups': category_groups
            })

        cleaned_data = {
            'automatic': [
                {
                    # Преобразование в строку и удаление пробелов
                    'id': str(item['id']).strip(),  
                    'name': str(item['name']).strip(), 
                    'price': float(item['price'])  
                }
                # Берем данные только для соответствующей группы
                for item in original_data.get('automatic', [])  
            ],

            # Аналогичные действия для других категорий
            'transformer': [
                {
                    'id': str(item['id']).strip(), 
                    'name': str(item['name']).strip(), 
                    'price': float(item['price']) 
                }
                for item in original_data.get('transformer', [])  
            ],
            'counter': [
                {
                    'id': str(item['id']).strip(), 
                    'name': str(item['name']).strip(),  
                    'price': float(item['price'])  
                }
                for item in original_data.get('counter', [])  
            ],
        }

        # Сериализация в JSON с настройками:
        original_data_json = mark_safe(json.dumps(
            cleaned_data,
            # Кириллица
            ensure_ascii=False,  
            # Компактный формат
            indent=None,         
            separators=(',', ':')
        ))
        #  Валидация JSON перед отправкой
        try:
            json.loads(original_data_json)  # Попытка распарсить обратно
        except json.JSONDecodeError as e:
            # Логирование ошибки если JSON невалидный
            print(f"Invalid JSON: {str(e)}\nSample Data: {original_data_json[:200]}...")
            original_data_json = '{}'  # Отправляем пустой объект при ошибке

        # Подготовка контекста для шаблона
        context = {
            # Основные категории
            'categories': final_categories, 
            # URL изображения 
            'result_image_url': component_with_image.image.url, 
            # Очищенные данные в JSON 
            'original_data_json': original_data_json  
        }

        # Рендеринг шаблона с контекстом
        return render(request, 'recognition/results.html', context)
    
    except Exception as e:
        # Обработка ошибок в представлении
        error_msg = f"View error: {str(e)}"
        # Логирование в консоль сервера
        print(error_msg)  
        return render(request, 'recognition/results.html', {'error': error_msg})
    

@csrf_exempt
def process_pdf(request):
    """Обрабатывает PDF в изображение и обрабатывает его"""
    if request.method != 'POST':
        logger.error("Method not allowed")
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        if 'image' not in request.FILES:
            logger.error("No image provided")
            return JsonResponse({'error': 'No image provided'}, status=400)
        
        logger.info(f"Received file: {request.FILES['image'].name}")
        
        # Сохранение временного файла
        temp_path = handle_uploaded_file(request.FILES['image'])
        logger.info(f"File saved to: {temp_path}")
        
        # Обработка через API
        api = api_client.APIClient()
        api_response = api.detect_image(temp_path)
        logger.info(f"API response received: {api_response}")
        
        # Проверка, что ответ не пустой и содержит данные
        if not api_response or not isinstance(api_response, dict):
            logger.warning("API returned empty response - no elements detected")
            return JsonResponse({
                'error': 'no_elements_detected',
                'message': 'На изображении не обнаружено соответствующих элементов'
            }, status=200)
        
        if 'image_base64' not in api_response or 'detection_results' not in api_response:
            logger.error("Invalid API response format")
            return JsonResponse({
                'error': 'invalid_response',
                'message': 'Неверный формат ответа от системы распознавания'
            }, status=200)
        
        # Проверка, что есть результаты детекции
        detection_results = api_response['detection_results']
        if not detection_results or not any(detection_results):
            logger.warning("No detection results found in API response")
            return JsonResponse({
                'error': 'no_elements_detected',
                'message': 'На изображении не обнаружено соответствующих элементов'
            }, status=200)
        
        # Проверка, что есть хотя бы один непустой результат
        has_valid_results = False
        if isinstance(detection_results, list):
            for category in detection_results:
                if isinstance(category, list) and category:
                    for group in category:
                        if isinstance(group, list) and group:
                            has_valid_results = True
                            break
                    if has_valid_results:
                        break
        
        if not has_valid_results:
            logger.warning("No valid detection results found")
            return JsonResponse({
                'error': 'no_elements_detected',
                'message': 'На изображении не обнаружено соответствующих элементов'
            }, status=200)
        
        # Сохранение результатов
        success, image_path = save_detection_results(
            detection_results, 
            api_response['image_base64']
        )
        
        if not success:
            logger.error("Failed to save results")
            return JsonResponse({
                'error': 'save_failed',
                'message': 'Не удалось сохранить результаты'
            }, status=200)
        
        # Удаление временного файла
        try:
            os.unlink(temp_path)
            logger.info("Temporary file deleted")
        except Exception as e:
            logger.warning(f"Could not delete temp file: {str(e)}")
        
        return JsonResponse({
            'redirect_url': reverse('results'),
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