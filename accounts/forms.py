from django import forms
from django.contrib.auth.forms import UserCreationForm
from .models import User

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
    
    # Необязательные поля
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
        error_messages={
            'required': 'Введите имя пользователя или email',
        },
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': 'Имя пользователя или Email'
        })
    )
    password = forms.CharField(
        label='Пароль',
        required=True,
        error_messages={
            'required': 'Введите пароль',
        },
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
                # Пробуем найти по email
                try:
                    user_obj = User.objects.get(email=username)
                    user = authenticate(username=user_obj.username, password=password)
                except User.DoesNotExist:
                    pass
                
            if not user:
                # Вместо raise forms.ValidationError используем add_error
                # чтобы поле подсветилось красным
                self.add_error('username', 'Неверное имя пользователя или пароль')
                self.add_error('password', '')
            else:
                self.user = user
        
        return cleaned_data
    
    def get_user(self):
        return getattr(self, 'user', None)