from django.db import models

class Component(models.Model):
    COMPONENT_TYPES = (
        ('automatic', 'Автоматические выключатели'),
        ('transformer', 'Трансформаторы'),
        ('counter', 'Счетчики'),
    )
    
    component_type = models.CharField(max_length=20, choices=COMPONENT_TYPES)
    article = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='detection_results/', blank=True, null=True)  # Изменили на ImageField
    created_at = models.DateTimeField(auto_now_add=True)
    # recognition_images/models.py
    object_id = models.CharField(
    max_length=10,
    null=True,  # Разрешить NULL в базе
    blank=True,  # Разрешить пустое значение в формах
    verbose_name='ID объекта'
    )
    group_index = models.IntegerField(null=True,  # Разрешить NULL в базе
    blank=True,  # Разрешить пустое значение в формах
    )
    def __str__(self):
        return f"{self.article} - {self.name}"