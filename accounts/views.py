from django.shortcuts import render, redirect
from django.contrib.auth import login, logout, authenticate
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from .forms import CustomUserCreationForm, CustomAuthenticationForm
from recognition_images.models import DetectionResult, Component
from django.shortcuts import render, get_object_or_404
import logging
from django.http import JsonResponse
from django.utils.http import urlsafe_base64_decode
from django.utils.encoding import force_str
from django.contrib.auth.tokens import default_token_generator
from django.contrib.auth import get_user_model
from .utils import send_verification_email
from django.views.decorators.csrf import csrf_protect
from django.views.decorators.cache import never_cache
from django.contrib.auth.views import PasswordResetView, PasswordResetDoneView, PasswordResetConfirmView, PasswordResetCompleteView

User = get_user_model()
logger = logging.getLogger(__name__)

@never_cache
@csrf_protect
def register_view(request):

    if request.user.is_authenticated:
        messages.info(request, 'Вы уже вошли в систему.')
        return redirect('dashboard')
    
    if request.method == 'POST':
        form = CustomUserCreationForm(request.POST)
        if form.is_valid():
            # Создание неактивированного пользователя
            user = form.save(commit=False)
            user.is_active = False
            user.save()
            
            # Отправка письма с подтверждением
            send_verification_email(request, user)
            
            # Сохранение email в сессии для отображения на странице подтверждения
            request.session['registered_email'] = user.email
            
            messages.success(
                request, 
                'Регистрация прошла успешно! На ваш email отправлено письмо с ссылкой для подтверждения.'
            )
            
            # Перенаправление на новую страницу
            return redirect('registration_complete')
        else:
            messages.error(request, 'Пожалуйста, исправьте ошибки в форме')
    else:
        form = CustomUserCreationForm()
    
    return render(request, 'accounts/register.html', {'form': form})

def registration_complete_view(request):
    """Страница после успешной регистрации с просьбой подтвердить email"""
    return render(request, 'accounts/registration_complete.html', {'user': request.user})

@never_cache
def verify_email(request, uidb64, token):
    """Подтверждение email по ссылке из письма"""
    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        user = None
    
    if user is not None and default_token_generator.check_token(user, token):
        if user.is_active:
            messages.info(request, 'Ваш email уже был подтверждён ранее. Можете войти в систему.')
            return redirect('login')
        
        user.is_active = True
        user.save()
        messages.success(request, 'Email успешно подтвержден! Теперь вы можете войти в аккаунт.')
        return redirect('login')
    else:
        messages.error(request, 'Ссылка для подтверждения недействительна или устарела.')
        return redirect('register')

@never_cache
def view_result(request, result_id):
    """Просмотр конкретного результата (версия для accounts)"""
    try:
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
    
def resend_verification_email(request):
    """Повторная отправка письма с подтверждением"""
    if request.method == 'POST':
        email = request.POST.get('email')
        
        try:
            user = User.objects.get(email=email, is_active=False)
            send_verification_email(request, user)
            messages.success(request, 'Письмо с подтверждением отправлено повторно!')
        except User.DoesNotExist:
            messages.error(request, 'Пользователь с таким email не найден или уже активирован.')
        
        return redirect('registration_complete')
    
    return redirect('register')

@never_cache
@csrf_protect
def login_view(request):
   
    if request.user.is_authenticated:
        messages.info(request, 'Вы уже вошли в систему.')
        return redirect('dashboard')
    
    if request.method == 'POST':
        form = CustomAuthenticationForm(request.POST)
        if form.is_valid():
            user = form.get_user()
            
            if not user.is_active:
                send_verification_email(request, user)
                messages.warning(
                    request, 
                    'Ваш email не подтвержден. Мы отправили новое письмо с ссылкой для подтверждения.'
                )
                return redirect('login')
            
            login(request, user)
            request.session.set_expiry(2592000)  # 30 дней
            
            # Переносим данные из анонимной сессии
            session_key = request.session.session_key
            DetectionResult.objects.filter(
                session_key=session_key, 
                user__isnull=True
            ).update(user=user)
            Component.objects.filter(
                session_key=session_key, 
                user__isnull=True
            ).update(user=user)
            
            messages.success(request, f'Добро пожаловать, {user.username}!')
            next_url = request.GET.get('next', 'dashboard')
            return redirect(next_url)
    else:
        form = CustomAuthenticationForm()
    
    return render(request, 'accounts/login.html', {'form': form})

@never_cache
def logout_view(request):
    logout(request)
    messages.success(request, 'Вы успешно вышли из системы')
    return redirect('upload')

@login_required
@never_cache
def dashboard_view(request):
    """Личный кабинет пользователя / История запросов за последний месяц"""
    from django.utils import timezone
    from datetime import timedelta
    
    month_ago = timezone.now() - timedelta(days=30)
    
    recent_results = DetectionResult.objects.filter(
        user=request.user,
        created_at__gte=month_ago
    ).order_by('-created_at')
    
    for result in recent_results:
        if result.image_base64 and not result.image_base64.startswith('data:image'):
            result.image_base64 = f"data:image/jpeg;base64,{result.image_base64}"
    
    context = {
        'recent_results': recent_results,
        'total_results': recent_results.count(),
    }
    return render(request, 'accounts/dashboard.html', context)

@login_required
@never_cache
def profile_view(request):
    """Просмотр и редактирование профиля"""
    if request.method == 'POST':
        user = request.user
        user.first_name = request.POST.get('first_name', '')
        user.last_name = request.POST.get('last_name', '')
        user.phone = request.POST.get('phone', '')
        user.company = request.POST.get('company', '')
        user.position = request.POST.get('position', '')
        
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
            
            components_count = Component.objects.filter(
                result_id=result_id,
                user=request.user
            ).count()
            
            Component.objects.filter(
                result_id=result_id,
                user=request.user
            ).delete()
            
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

class CustomPasswordResetView(PasswordResetView):
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            messages.info(request, 'Вы уже вошли в систему. Используйте профиль для смены пароля.')
            return redirect('dashboard')
        return super().dispatch(request, *args, **kwargs)

class CustomPasswordResetDoneView(PasswordResetDoneView):
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('dashboard')
        return super().dispatch(request, *args, **kwargs)

class CustomPasswordResetConfirmView(PasswordResetConfirmView):
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('dashboard')
        return super().dispatch(request, *args, **kwargs)

class CustomPasswordResetCompleteView(PasswordResetCompleteView):
    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('dashboard')
        return super().dispatch(request, *args, **kwargs)