from django.urls import path
from . import views 

urlpatterns = [
     path('register/', views.register_view, name='register'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('dashboard/', views.dashboard_view, name='dashboard'),
    path('profile/', views.profile_view, name='profile'),

    # Новый URL для просмотра результата
    path('result/<str:result_id>/', views.view_result, name='view_result'),
    path('results/delete/', views.delete_result, name='delete_result'),
    path('password-reset/', views.password_reset_view, name='password_reset'),

    
    # Для работы с аккаунтом
    # path('my-results/', views.my_results_list, name='my_results'),
    # path('result/<str:result_id>/toggle-favorite/', views.toggle_favorite, name='toggle_favorite'),
    # path('result/<str:result_id>/save-to-account/', views.save_result_to_account, name='save_result_to_account'),
]