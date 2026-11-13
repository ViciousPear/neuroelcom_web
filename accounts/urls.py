from django.urls import path
from . import views 
from django.contrib.auth import views as auth_views
from accounts.forms import CustomPasswordResetForm

urlpatterns = [
    path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('profile/', views.profile_view, name='profile'),
    path('verify-email/<str:uidb64>/<str:token>/', views.verify_email, name='verify_email'),
    
    # Восстановление пароля с кастомными классами для защиты
    path('password-reset/',
         views.CustomPasswordResetView.as_view(
             form_class=CustomPasswordResetForm,
             template_name='accounts/password_reset.html',
             subject_template_name='accounts/email/password_reset_subject.txt',
             email_template_name='accounts/email/password_reset_email.html',
             success_url='/accounts/password-reset/done/'
         ),
         name='password_reset'),
    
    path('password-reset/done/',
         views.CustomPasswordResetDoneView.as_view(
             template_name='accounts/password_reset_done.html'
         ),
         name='password_reset_done'),
    
    path('reset/<uidb64>/<token>/',
         views.CustomPasswordResetConfirmView.as_view(
             template_name='accounts/password_reset_confirm.html',
             success_url='/accounts/reset/done/'
         ),
         name='password_reset_confirm'),
    
    path('reset/done/',
         views.CustomPasswordResetCompleteView.as_view(
             template_name='accounts/password_reset_complete.html'
         ),
         name='password_reset_complete'),

    path('registration-complete/', views.registration_complete_view, name='registration_complete'),
    path('resend-verification/', views.resend_verification_email, name='resend_verification'),
]
    # Для работы с аккаунтом
    # path('my-results/', views.my_results_list, name='my_results'),
    # path('result/<str:result_id>/toggle-favorite/', views.toggle_favorite, name='toggle_favorite'),
    # path('result/<str:result_id>/save-to-account/', views.save_result_to_account, name='save_result_to_account'),
