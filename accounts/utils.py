from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator
from django.conf import settings



def send_verification_email(request, user):
    """Отправка письма для подтверждения email"""
    token = default_token_generator.make_token(user)
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    
    # Создаем ссылку для подтверждения
    verification_url = f"{settings.SITE_URL}/accounts/verify-email/{uid}/{token}/"
    
    # Тема письма
    subject = 'Подтверждение email - NeuroElcom'
    
    # Текст письма (HTML)
    html_message = render_to_string('accounts/email/verification_email.html', {
        'user': user,
        'verification_url': verification_url,
        'site_name': 'NeuroElcom'
    })
    
    # Текст письма (plain text)
    plain_message = f"""
    Здравствуйте, {user.username}!
    
    Для подтверждения вашего email и активации аккаунта перейдите по ссылке:
    {verification_url}
    
    Если вы не регистрировались на сайте NeuroElcom, просто проигнорируйте это письмо.
    
    С уважением,
    Команда NeuroElcom
    """
    
    # Отправляем письмо
    send_mail(
        subject,
        plain_message,
        settings.DEFAULT_FROM_EMAIL,
        [user.email],
        html_message=html_message,
        fail_silently=False,
    )