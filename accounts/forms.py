from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.contrib.auth.forms import PasswordResetForm
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings


class CustomUserCreationForm(UserCreationForm):
    # Обязательные поля
    username = forms.CharField(
        label='Имя пользователя',
        max_length=150,
        required=True,
        error_messages={
            'required': 'Обязательное поле',
            'unique': 'Пользователь с таким именем уже существует',
        },
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Введите имя пользователя'
        })
    )
    email = forms.EmailField(
        label='Email',
        required=True,
        error_messages={
            'required': 'Обязательное поле',
            'invalid': 'Введите корректный email адрес',
        },
        widget=forms.EmailInput(attrs={
            'class': 'form-control',
            'placeholder': 'Введите email'
        })
    )
    phone = forms.CharField(
        label='Номер телефона',
        max_length=15,
        required=True,
        error_messages={
            'required': 'Обязательное поле',
        },
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '+7 (999) 999-99-99'
        })
    )
    first_name = forms.CharField(
        label='Имя',
        max_length=150,
        required=True,
        error_messages={
            'required': 'Обязательное поле',
        },
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Введите имя'
        })
    )
    last_name = forms.CharField(
        label='Фамилия',
        max_length=150,
        required=True,
        error_messages={
            'required': 'Обязательное поле',
        },
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Введите фамилию'
        })
    )
    password1 = forms.CharField(
        label='Пароль',
        required=True,
        error_messages={
            'required': 'Обязательное поле',
        },
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Введите пароль'
        })
    )
    password2 = forms.CharField(
        label='Подтверждение пароля',
        required=True,
        error_messages={
            'required': 'Обязательное поле',
        },
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Повторите пароль'
        })
    )
    
    company = forms.CharField(
        label='Компания',
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Название компании (необязательно)'
        })
    )
    position = forms.CharField(
        label='Должность',
        max_length=255,
        required=False,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Ваша должность (необязательно)'
        })
    )

    def send_verification_email(self, request, user):
        """Отправка письма для подтверждения email"""
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        
        # Ссылка для подтверждения
        verification_url = f"{settings.SITE_URL}/accounts/verify-email/{uid}/{token}/"
        
        # Тема письма
        subject = 'Подтверждение email - NeuroElcom'
        
        html_message = render_to_string('accounts/email/verification_email.html', {
            'user': user,
            'verification_url': verification_url,
            'site_name': 'NeuroElcom'
        })
        
        plain_message = f"""
        Здравствуйте, {user.username}!
        
        Для подтверждения вашего email перейдите по ссылке:
        {verification_url}
        
        Если вы не регистрировались на сайте NeuroElcom, просто проигнорируйте это письмо.
        
        С уважением,
        Команда NeuroElcom
        """
        
        send_mail(
            subject,
            plain_message,
            settings.DEFAULT_FROM_EMAIL,
            [user.email],
            html_message=html_message,
            fail_silently=False,
        )
    
    class Meta:
        model = User
        fields = (
            'username', 'email', 'phone', 
            'first_name', 'last_name',
            'company', 'position',
            'password1', 'password2'
        )
    
    def clean_phone(self):
        phone = self.cleaned_data.get('phone')
        if phone and len(phone) < 10:
            raise forms.ValidationError('Номер телефона должен содержать не менее 10 символов')
        return phone
    
    def clean_email(self):
        email = self.cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise forms.ValidationError('Пользователь с таким email уже существует')
        return email
    
    def clean_password2(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError('Пароли не совпадают')
        return password2
    
    def save(self, commit=True):
        user = super().save(commit=False)
        user.email = self.cleaned_data.get('email')
        user.phone = self.cleaned_data.get('phone')
        user.first_name = self.cleaned_data.get('first_name')
        user.last_name = self.cleaned_data.get('last_name')
        user.company = self.cleaned_data.get('company') or None
        user.position = self.cleaned_data.get('position') or None
        
        if commit:
            user.save()
        return user


class CustomAuthenticationForm(forms.Form):
    username = forms.CharField(
        label='Имя пользователя или Email',
        required=True,
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Имя пользователя или Email'
        })
    )
    password = forms.CharField(
        label='Пароль',
        required=True,
        widget=forms.PasswordInput(attrs={
            'class': 'form-control',
            'placeholder': 'Пароль'
        })
    )
    
    def clean(self):
        cleaned_data = super().clean()
        username = cleaned_data.get('username')
        password = cleaned_data.get('password')
        
        if username and password:
            from django.contrib.auth import authenticate
            
            user = authenticate(username=username, password=password)
            
            if not user:
                try:
                    user_obj = User.objects.get(email=username)
                    user = authenticate(username=user_obj.username, password=password)
                except User.DoesNotExist:
                    pass
            
            if not user:
                raise forms.ValidationError('Неверное имя пользователя/email или пароль')
            
            self.user = user
        
        return cleaned_data
    
    def get_user(self):
        return getattr(self, 'user', None)
    
class CustomPasswordResetForm(PasswordResetForm):
    def send_mail(self, subject_template_name, email_template_name,
                  context, from_email, to_email, html_email_template_name=None):
        """
        Переопределяем метод отправки письма.
        Используем нашу проверенную логику с явным указанием from_email.
        """
        # from_email либо из переданного, либо из настроек
        from_email = from_email or settings.DEFAULT_FROM_EMAIL or 'elcomneuro@elcomspb.ru'
        
        subject = render_to_string(subject_template_name, context)
        subject = ''.join(subject.splitlines())
        
        # HTML-версия письма
        html_body = render_to_string(email_template_name, context)
        
        # Текстовая версия (простая)
        plain_body = f"Для сброса пароля перейдите по ссылке:\n{context['protocol']}://{context['domain']}{context['uid']}/{context['token']}/"
        
        send_mail(
            subject=subject,
            message=plain_body,
            from_email=from_email, 
            recipient_list=[to_email],
            html_message=html_body,
            fail_silently=False,
        )