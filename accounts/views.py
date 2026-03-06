from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .forms import CustomUserCreationForm, CustomAuthenticationForm
from recognition_images.models import DetectionResult, Component
from django.shortcuts import render, get_object_or_404
import logging
from django.http import JsonResponse
logger = logging.getLogger(__name__)

def register_view(request):
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            
            # Переносим данные из анонимной сессии в аккаунт
            session_key = request.session.session_key
            DetectionResult.objects.filter(
                session_key=session_key, 
                user__isnull=True
            ).update(user=user)
            Component.objects.filter(
                session_key=session_key, 
                user__isnull=True
            ).update(user=user)
            
            messages.success(request, 'Регистрация прошла успешно!')
            return redirect('dashboard')
        # Убираем messages.error - ошибки будут в форме
    else:
        form = CustomUserCreationForm()
    
    return render(request, 'accounts/register.html', {'form': form})

def view_result(request, result_id):
    """Просмотр конкретного результата (версия для accounts)"""
    try:
        # Ищем результат
        if request.user.is_authenticated:
            detection_result = get_object_or_404(
                DetectionResult, 
                result_id=result_id,
                user=request.user
            )
        else:
            detection_result = get_object_or_404(
                DetectionResult,
                result_id=result_id,
                session_key=request.session.session_key
            )
        
        # Получаем связанные компоненты
        components = Component.objects.filter(
            result_id=result_id
        ).order_by('component_type', 'group_index')
        
        context = {
            'result': detection_result,
            'components': components,
            'result_id': result_id,
        }
        
        return render(request, 'recognition/view_result.html', context)
        
    except Exception as e:
        messages.error(request, 'Результат не найден')
        return redirect('dashboard')

def login_view(request):
    if request.method == 'POST':
        form = CustomAuthenticationForm(request.POST)
        if form.is_valid():
            username = form.cleaned_data.get('username')
            password = form.cleaned_data.get('password')
            user = authenticate(request, username=username, password=password)
            if user is not None:
                login(request, user)
                
                # Устанавливаем долгую сессию для авторизованного пользователя
                request.session.set_expiry(2592000)  # 30 дней
                
                # Переносим данные из анонимной сессии
                session_key = request.session.session_key
                
                # Ищем результаты по старой сессии
                old_results = DetectionResult.objects.filter(
                    session_key=session_key, 
                    user__isnull=True
                )
                
                if old_results.exists():
                    # Переносим результаты
                    old_results.update(user=user)
                    
                    # Переносим компоненты
                    Component.objects.filter(
                        session_key=session_key, 
                        user__isnull=True
                    ).update(user=user)
                    
                    messages.success(
                        request, 
                        f'Добро пожаловать, {user.username}! Ваши результаты из гостевой сессии сохранены.'
                    )
                else:
                    # Проверяем, есть ли результаты с истекшей сессией по result_id
                    # (это сложнее, требует дополнительной логики)
                    pass
                
                next_url = request.GET.get('next', 'dashboard')
                return redirect(next_url)
    else:
        form = CustomAuthenticationForm()
    
    return render(request, 'accounts/login.html', {'form': form})

def logout_view(request):
    logout(request)
    messages.success(request, 'Вы успешно вышли из системы')
    return redirect('upload')

@login_required
def dashboard_view(request):
    """Личный кабинет пользователя / История запросов за последний месяц"""
    from django.utils import timezone
    from datetime import timedelta
    
    # Дата месяц назад
    month_ago = timezone.now() - timedelta(days=30)
    
    # Получаем результаты пользователя за последний месяц
    recent_results = DetectionResult.objects.filter(
        user=request.user,
        created_at__gte=month_ago  # только за последний месяц
    ).order_by('-created_at')
    
    # Для отладки - проверим формат изображений
    for result in recent_results:
        if result.image_base64:
            # Убедимся, что изображение в правильном формате
            if not result.image_base64.startswith('data:image'):
                # Если это просто base64, добавляем префикс
                result.image_base64 = f"data:image/jpeg;base64,{result.image_base64}"
    
    context = {
        'recent_results': recent_results,
        'total_results': recent_results.count(),
    }
    return render(request, 'accounts/dashboard.html', context)

@login_required
def profile_view(request):
    """Просмотр и редактирование профиля"""
    if request.method == 'POST':
        user = request.user
        user.first_name = request.POST.get('first_name', '')
        user.last_name = request.POST.get('last_name', '')
        user.phone = request.POST.get('phone', '')
        user.company = request.POST.get('company', '')
        user.position = request.POST.get('position', '')  # Добавлено поле должности
        user.save()
        messages.success(request, 'Профиль обновлен')
        return redirect('profile')
    
    return render(request, 'accounts/profile.html', {'user': request.user})

def password_reset_view(request):
    """Заглушка для восстановления пароля"""
    if request.method == 'POST':
        email = request.POST.get('email')
        # Здесь будет логика отправки письма
        messages.info(request, f'Инструкция по восстановлению пароля отправлена на {email}')
        return redirect('login')
    
    return render(request, 'accounts/password_reset.html')

@login_required
def profile_view(request):
    """Просмотр и редактирование профиля"""
    if request.method == 'POST':
        user = request.user
        user.first_name = request.POST.get('first_name', '')
        user.last_name = request.POST.get('last_name', '')
        user.phone = request.POST.get('phone', '')
        user.company = request.POST.get('company', '')
        user.position = request.POST.get('position', '')
        
        # Обработка загрузки аватара
        if 'avatar' in request.FILES:
            user.avatar = request.FILES['avatar']
        
        user.save()
        messages.success(request, 'Профиль успешно обновлен')
        return redirect('profile')
    
    return render(request, 'accounts/profile.html', {'user': request.user})

@login_required
def delete_result(request):
    """Удаление результата из истории через GET параметр result_id"""
    if request.method == 'POST':
        # Получаем result_id из GET параметров
        result_id = request.GET.get('result_id')
        
        if not result_id:
            return JsonResponse({
                'success': False, 
                'error': 'ID результата не указан'
            }, status=400)
        
        try:
            logger.info(f"Попытка удаления результата {result_id} пользователем {request.user.username}")
            
            result = DetectionResult.objects.get(
                result_id=result_id,
                user=request.user
            )
            
            # Удаляем связанные компоненты
            components_count = Component.objects.filter(
                result_id=result_id,
                user=request.user
            ).count()
            
            Component.objects.filter(
                result_id=result_id,
                user=request.user
            ).delete()
            
            # Сохраняем имя для лога перед удалением
            result_name = result.name
            
            result.delete()
            
            logger.info(f"Результат {result_id} ({result_name}) удален. Удалено компонентов: {components_count}")
            
            return JsonResponse({
                'success': True,
                'message': 'Результат успешно удален'
            })
            
        except DetectionResult.DoesNotExist:
            logger.error(f"Результат {result_id} не найден для пользователя {request.user.username}")
            return JsonResponse({
                'success': False, 
                'error': 'Результат не найден'
            }, status=404)
            
        except Exception as e:
            logger.error(f"Ошибка при удалении результата {result_id}: {str(e)}")
            return JsonResponse({
                'success': False, 
                'error': str(e)
            }, status=500)
    
    return JsonResponse({
        'success': False, 
        'error': 'Метод не поддерживается'
    }, status=405)