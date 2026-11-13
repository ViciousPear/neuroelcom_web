from django.contrib import messages
from django.utils import timezone
from .models import UserSession
import os

class ClearMessagesMiddleware:
    """Middleware для очистки сообщений на страницах с формами"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # Страницы, на которых мы не хотим видеть старые сообщения
        clean_pages = [
            '/login/',
            '/register/',
            '/upload/',
            '/',
        ]
        
        response = self.get_response(request)
        
        # После обработки запроса проверяем, нужно ли очистить сообщения
        if any(request.path.startswith(page) for page in clean_pages):
            # Очищаем хранилище сообщений
            storage = messages.get_messages(request)
            storage.used = True
        
        return response

# middleware.py

class DynamicSessionMiddleware:
    """Middleware для динамического управления временем жизни сессии"""
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request):
        # установка обработки view
        if hasattr(request, 'session') and request.session.session_key:
            if request.user.is_authenticated:
                request.session.set_expiry(2592000)  # 30 дней
            else:
                request.session.set_expiry(86400)   # 1 день
        
        response = self.get_response(request)
        
        # Логирование сессий после обработки
        if hasattr(request, 'session') and request.session.session_key:
            session_key = request.session.session_key
            
            if request.user.is_authenticated:
                user_session, created = UserSession.objects.update_or_create(
                    session_key=session_key,
                    defaults={
                        'user': request.user,
                        'ip_address': request.META.get('REMOTE_ADDR'),
                        'user_agent': request.META.get('HTTP_USER_AGENT', '')[:255],
                        'last_activity': timezone.now(),
                        'is_active': True
                    }
                )
                
                if created and hasattr(request, 'session_results'):
                    for result in request.session_results:
                        user_session.results.add(result)
        
        return response