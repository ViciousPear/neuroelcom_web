import os
from datetime import datetime
import tempfile

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
