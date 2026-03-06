from django.urls import path
from . import views 
from accounts import views as accounts_views

urlpatterns = [
    path('', views.upload_file, name='upload'),
    path('edit/', views.edit_results_view, name='edit_results'),
    path('save-edited-results/', views.save_edited_results, name='save_edited_results'),
    path('search-db/', views.process_edited_data, name='process_edited_data'),  # AJAX запрос для поиска
    path('results/', views.results_view, name='results'),  # GET запрос для отображения результатов
    path('create-pdf/', views.create_pdf, name='create_pdf'),
    path('process-pdf/', views.process_pdf, name='process_pdf'),
    path('api/check-results-access/', views.api_check_results_access, name='api_check_results_access'),

    path('result/<str:result_id>/', views.view_result_by_id, name='view_result'),
    path('results/delete/', accounts_views.delete_result, name='delete_result'),
    # path('debug-components/<str:result_id>/', views.debug_components, name='debug_components'),
]