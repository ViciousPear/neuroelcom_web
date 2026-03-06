from django.contrib import admin
from django.utils.html import format_html
from .models import Component, DetectionResult

@admin.register(Component)
class ComponentAdmin(admin.ModelAdmin):
    """Админка для компонентов"""
    
    list_display = (
        'id', 'name', 'article', 'component_type', 
        'user_link', 'session_key_short', 'quantity', 
        'price', 'created_at', 'image_preview'
    )
    
    list_filter = ('component_type', 'created_at', 'user')
    
    search_fields = ('name', 'article', 'user__username', 'session_key')
    
    readonly_fields = ('created_at', 'image_preview')
    
    list_per_page = 50
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('component_type', 'article', 'name', 'price', 'quantity')
        }),
        ('Распознавание', {
            'fields': ('object_id', 'group_index', 'image')
        }),
        ('Владелец', {
            'fields': ('user', 'session_key', 'result_id', 'old_user_id')
        }),
        ('Метаданные', {
            'fields': ('created_at', 'image_preview'),
            'classes': ('collapse',)
        }),
    )
    
    def user_link(self, obj):
        if obj.user:
            return format_html(
                '<a href="/admin/accounts/user/{}/">{}</a>',
                obj.user.id, obj.user.username
            )
        return "Аноним"
    user_link.short_description = 'Пользователь'
    
    def session_key_short(self, obj):
        if obj.session_key:
            return f"{obj.session_key[:10]}..."
        return "-"
    session_key_short.short_description = 'Session'
    
    def image_preview(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" style="max-height: 50px;" />',
                obj.image.url
            )
        return "Нет изображения"
    image_preview.short_description = 'Превью'

@admin.register(DetectionResult)
class DetectionResultAdmin(admin.ModelAdmin):
    """Админка для результатов распознавания"""
    
    list_display = (
        'id', 'result_id_short', 'user_link', 'session_key_short',
        'name', 'created_at', 'is_edited', 
        'components_count'
    )
    
    list_filter = ('is_edited', 'created_at', 'user')
    
    search_fields = ('name', 'result_id', 'user__username', 'session_key')
    
    readonly_fields = ('created_at', 'result_id', 'preview_data')
    
    list_per_page = 25
    
    fieldsets = (
        ('Основное', {
            'fields': ('name', 'user', 'session_key', 'result_id')
        }),
        ('Статус', {
            'fields': ('is_edited', 'is_favorite')
        }),
        ('Данные', {
            'fields': ('detected_data', 'edited_data', 'search_results'),
            'classes': ('wide',)
        }),
        ('Изображение', {
            'fields': ('image_base64', 'preview_data'),
            'classes': ('collapse',)
        }),
        ('Метаданные', {
            'fields': ('created_at',),
            'classes': ('collapse',)
        }),
    )
    
    def result_id_short(self, obj):
        return f"{obj.result_id[:8]}..." if obj.result_id else "-"
    result_id_short.short_description = 'Result ID'
    
    def user_link(self, obj):
        if obj.user:
            return format_html(
                '<a href="/admin/accounts/user/{}/">{}</a>',
                obj.user.id, obj.user.username
            )
        return "Аноним"
    user_link.short_description = 'Пользователь'
    
    def session_key_short(self, obj):
        if obj.session_key:
            return f"{obj.session_key[:10]}..."
        return "-"
    session_key_short.short_description = 'Session'
    
    def components_count(self, obj):
        if obj.detected_data and 'components' in obj.detected_data:
            return len(obj.detected_data['components'])
        return 0
    components_count.short_description = 'Компонентов'
    
    def preview_data(self, obj):
        """Превью данных в читаемом формате"""
        if obj.detected_data:
            import json
            return format_html(
                '<pre style="max-height: 300px; overflow: auto;">{}</pre>',
                json.dumps(obj.detected_data, indent=2, ensure_ascii=False)
            )
        return "Нет данных"
    preview_data.short_description = 'Превью данных'
    
    actions = ['mark_as_favorite', 'unmark_as_favorite', 'export_selected']
    
    def mark_as_favorite(self, request, queryset):
        queryset.update(is_favorite=True)
        self.message_user(request, f"{queryset.count()} результатов отмечено как избранное")
    mark_as_favorite.short_description = "Отметить как избранное"
    
    def unmark_as_favorite(self, request, queryset):
        queryset.update(is_favorite=False)
        self.message_user(request, f"{queryset.count()} результатов убрано из избранного")
    unmark_as_favorite.short_description = "Убрать из избранного"
    
    def export_selected(self, request, queryset):
        # Здесь можно добавить экспорт в CSV/JSON
        from django.http import JsonResponse
        data = list(queryset.values('id', 'name', 'created_at', 'is_edited'))
        return JsonResponse(data, safe=False)
    export_selected.short_description = "Экспортировать выбранные"