import os
from datetime import datetime
import tempfile
from django.utils import timezone
from datetime import timedelta
from django.core.cache import cache
from . import models  # импорт моделей


def validate_result(session_key, result_id):
    """
    Проверяет, является ли результат валидным (существует и не устарел)
    
    Args:
        session_key (str): Ключ сессии пользователя
        result_id (str): ID результата для проверки
    
    Returns:
        bool: True если результат валиден, False если устарел или не существует
    """
    if not result_id or not session_key:
        return False
    
    # Проверяем кэш для производительности (необязательно, но рекомендуется)
    cache_key = f"result_valid_{session_key}_{result_id}"
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    # Проверяем в базе данных - результат должен быть не старше 1 часа
    one_hour_ago = timezone.now() - timedelta(hours=1)
    
    is_valid = models.Component.objects.filter(
        result_id=result_id,
        session_key=session_key,
        created_at__gte=one_hour_ago  # created_at >= one_hour_ago
    ).exists()
    
    # Кэшируем результат на 5 минут для уменьшения нагрузки на БД
    cache.set(cache_key, is_valid, 300)  # 300 секунд = 5 минут
    
    return is_valid

def check_results_access(request):
    """
    Проверяет, есть ли у текущего пользователя доступ к результатам
    
    Args:
        request: Django request object
    
    Returns:
        bool: True если есть доступ к результатам, False если нет
    """
    result_id = request.session.get('last_result_id')
    has_access = False
    
    if result_id and request.session.session_key:
        has_access = validate_result(request.session.session_key, result_id)
    
    return has_access

    
#перенести  
def handle_uploaded_file(file):
    """Сохраняет временный файл и возвращает путь"""
    temp_dir = tempfile.gettempdir()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_path = os.path.join(temp_dir, f"upload_{timestamp}_{file.name}")
    
    with open(temp_path, 'wb+') as destination:
        for chunk in file.chunks():
            destination.write(chunk)
    
    return temp_path

def save_result_image(image_bytes):
    """Сохраняет обработанное изображение"""
    images_dir = 'media/results'
    os.makedirs(images_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    file_name = f"result_{timestamp}.png"
    file_path = os.path.join(images_dir, file_name)
    
    with open(file_path, 'wb') as f:
        f.write(image_bytes)
    
    return file_path
  
def get_category_name(component_type):
    names = {
        'automatic': 'Автоматические выключатели',
        'transformer': 'Трансформаторы',
        'counter': "Счетчики 'Меркурий'"
    }
    return names.get(component_type, 'Другие')

def get_component_type(article):
    """Определяет тип компонента по артикулу"""
    if article.startswith(('13.01','13.02','13.03','14.01', '14.02', '13.07')):
        return 'automatic'
    elif article.startswith(('ITB', 'ITT', '15')):
        return 'transformer'
    try:
        num = int(article)
        if 1 <= num <= 50:
            return 'counter'
    except ValueError:
        pass 
    return 'other'
