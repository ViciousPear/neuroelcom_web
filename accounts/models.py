from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone

class User(AbstractUser):
    """Расширенная модель пользователя"""
    
    # Переопределяем стандартные поля, чтобы сделать их обязательными
    first_name = models.CharField(
        'Имя', 
        max_length=150,
        blank=False,  # Не может быть пустым
        null=False    # Не может быть NULL
    )
    last_name = models.CharField(
        'Фамилия', 
        max_length=150,
        blank=False,
        null=False
    )
    email = models.EmailField(
        'Email',
        max_length=254,
        unique=True,  # Email должен быть уникальным
        blank=False,
        null=False
    )
    
    # Дополнительные поля
    phone = models.CharField(
        'Телефон', 
        max_length=15, 
        blank=False,  # Обязательное поле
        null=False
    )
    company = models.CharField(
        'Компания', 
        max_length=255, 
        blank=True,   # Необязательное поле
        null=True
    )
    position = models.CharField(
        'Должность', 
        max_length=255, 
        blank=True,   # Необязательное поле
        null=True
    )
    avatar = models.ImageField(
        'Аватар', 
        upload_to='avatars/', 
        null=True, 
        blank=True
    )
    created_at = models.DateTimeField(
        'Дата регистрации', 
        auto_now_add=True
    )
    last_activity = models.DateTimeField(
        'Последняя активность', 
        auto_now=True
    )
    
    # Разрешить вход по email
    EMAIL_FIELD = 'email'
    USERNAME_FIELD = 'username'
    REQUIRED_FIELDS = ['email', 'first_name', 'last_name', 'phone']  # Обязательные поля
    
    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        db_table = 'accounts_user'
    
    def __str__(self):
        return f"{self.last_name} {self.first_name} ({self.username})"
    
    def get_full_name(self):
        """Полное имя пользователя"""
        return f"{self.last_name} {self.first_name}".strip()
    
    def get_short_name(self):
        """Короткое имя пользователя"""
        return self.first_name
    
    def get_active_sessions(self):
        """Получить все активные сессии пользователя"""
        return self.sessions.filter(is_active=True)
    
    def terminate_all_sessions(self):
        """Завершить все сессии пользователя"""
        self.sessions.update(is_active=False)


class UserSession(models.Model):
    """Модель для отслеживания сессий пользователя"""
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='sessions',
        verbose_name='Пользователь'
    )
    session_key = models.CharField(
        'Ключ сессии', 
        max_length=40, 
        unique=True,
        db_index=True
    )
    ip_address = models.GenericIPAddressField(
        'IP адрес', 
        null=True, 
        blank=True
    )
    user_agent = models.TextField(
        'User Agent', 
        blank=True
    )
    created_at = models.DateTimeField(
        'Создана', 
        auto_now_add=True,
        db_index=True
    )
    last_activity = models.DateTimeField(
        'Последняя активность', 
        auto_now=True
    )
    is_active = models.BooleanField(
        'Активна', 
        default=True,
        db_index=True
    )
    
    class Meta:
        verbose_name = 'Сессия пользователя'
        verbose_name_plural = 'Сессии пользователей'
        db_table = 'accounts_usersession'
        ordering = ['-last_activity']
        indexes = [
            models.Index(fields=['user', '-last_activity']),
            models.Index(fields=['session_key']),
            models.Index(fields=['is_active', '-created_at']),
        ]
    
    def __str__(self):
        return f"Сессия {self.user.get_full_name()} от {self.created_at.strftime('%d.%m.%Y %H:%M')}"
    
    def get_duration(self):
        """Получить длительность сессии"""
        if self.created_at and self.last_activity:
            duration = self.last_activity - self.created_at
            hours = duration.total_seconds() / 3600
            if hours < 24:
                return f"{hours:.1f} ч"
            else:
                days = hours / 24
                return f"{days:.1f} дн"
        return "—"
    get_duration.short_description = 'Длительность'
    
    def terminate(self):
        """Завершить сессию"""
        self.is_active = False
        self.save()