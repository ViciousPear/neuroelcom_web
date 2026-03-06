from django.db import models
from django.conf import settings

class Component(models.Model):
    COMPONENT_TYPES = (
        ('automatic', 'Автоматические выключатели'),
        ('transformer', 'Трансформаторы'),
        ('counter', 'Счетчики'),
    )

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='components'
    )
    
    old_user_id = models.IntegerField(null=True, blank=True)
    
    component_type = models.CharField(max_length=20, choices=COMPONENT_TYPES)
    article = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    image = models.ImageField(upload_to='detection_results/', blank=True, null=True)
    
    object_id = models.CharField(
        max_length=10,
        null=True,
        blank=True,
        verbose_name='ID объекта'
    )
    
    group_index = models.IntegerField(
        null=True,
        blank=True,
    )

    quantity = models.IntegerField(
        default=1,
        verbose_name='Количество'
    )

    session_key = models.CharField(max_length=40, db_index=True, default='')
    result_id = models.CharField(max_length=36, db_index=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['session_key', 'result_id'], name='comp_session_result_idx'),
            models.Index(fields=['created_at'], name='comp_created_at_idx'),
        ]
        db_table = 'recognition_images_component'  # Явно указываем имя таблицы

    def __str__(self):
        return f"{self.article} - {self.name}"
    
    @classmethod
    def cleanup_old_results(cls, hours=24):
        from django.utils import timezone
        from datetime import timedelta
        
        cutoff_time = timezone.now() - timedelta(hours=hours)
        old_components = cls.objects.filter(created_at__lt=cutoff_time)
        count = old_components.count()
        old_components.delete()
        return count

class DetectionResult(models.Model):
    session_key = models.CharField(max_length=100)
    result_id = models.CharField(max_length=100, unique=True)
    image_base64 = models.TextField()
    search_results = models.JSONField(null=True, blank=True)
    detected_data = models.JSONField()
    edited_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_edited = models.BooleanField(default=False)
    edited_at = models.DateTimeField(auto_now=True)

    name = models.CharField('Название', max_length=255, default='Без названия')
    is_favorite = models.BooleanField('Избранное', default=False)

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='detection_results'
    )
    
    old_user_id = models.IntegerField(null=True, blank=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['session_key', 'result_id'], name='detect_session_result_idx'),
            models.Index(fields=['created_at'], name='detect_created_at_idx'),
        ]
        db_table = 'recognition_images_detectionresult'