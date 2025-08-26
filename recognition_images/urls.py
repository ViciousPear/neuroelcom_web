from django.urls import path
from . import views  # Импорт ваших представлений

urlpatterns = [
    path('', views.upload_file, name='upload'),
    path('results/', views.results_view, name='results'),
    path('create-pdf/', views.create_pdf, name='create_pdf'),
    path('process-pdf/', views.process_pdf, name='process_pdf'),
]