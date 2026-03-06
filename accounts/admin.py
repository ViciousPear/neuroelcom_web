from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.utils.html import format_html
from .models import User, UserSession

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """Админка для управления пользователями"""
    
    list_display = (
        'id', 'username', 'email', 'phone', 'company', 
        'is_staff', 'is_active', 'date_joined', 'last_activity',
        'avatar_preview', 'sessions_count'
    )
    
    list_filter = (
        'is_staff', 'is_superuser', 'is_active', 
        'date_joined', 'last_activity', 'company'
    )
    
    search_fields = ('username', 'email', 'phone', 'company', 'first_name', 'last_name')
    ordering = ('-date_joined',)
    list_per_page = 25
    list_editable = ('is_active', 'phone', 'company')
    
    fieldsets = (
        (None, {
            'fields': ('username', 'password')
        }),
        ('Персональная информация', {
            'fields': (
                'first_name', 'last_name', 'email', 
                'phone', 'company', 'avatar'
            )
        }),
        ('Разрешения', {
            'fields': (
                'is_active', 'is_staff', 'is_superuser',
                'groups', 'user_permissions'
            ),
            'classes': ('collapse',),
        }),
        ('Важные даты', {
            'fields': ('last_login', 'date_joined', 'last_activity'),
            'classes': ('collapse',),
        }),
    )
    
    def avatar_preview(self, obj):
        if obj.avatar:
            return format_html(
                '<img src="{}" style="width: 40px; height: 40px; border-radius: 50%;" />',
                obj.avatar.url
            )
        return "—"
    avatar_preview.short_description = 'Аватар'
    
    def sessions_count(self, obj):
        count = obj.sessions.filter(is_active=True).count()
        if count:
            return format_html(
                '<span style="color: green; font-weight: bold;">{} активных</span>',
                count
            )
        return "0"
    sessions_count.short_description = 'Сессии'
    
    actions = ['activate_users', 'deactivate_users']
    
    def activate_users(self, request, queryset):
        queryset.update(is_active=True)
        self.message_user(request, f"{queryset.count()} пользователей активировано")
    activate_users.short_description = "Активировать выбранных пользователей"
    
    def deactivate_users(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} пользователей деактивировано")
    deactivate_users.short_description = "Деактивировать выбранных пользователей"


@admin.register(UserSession)
class UserSessionAdmin(admin.ModelAdmin):
    """Админка для отслеживания сессий пользователей"""
    
    list_display = (
        'id', 'user_link', 'session_key_short', 'ip_address', 
        'user_agent_short', 'created_at', 'last_activity', 
        'is_active', 'get_duration'
    )
    
    list_filter = ('is_active', 'created_at', 'last_activity')
    
    search_fields = ('user__username', 'user__email', 'ip_address', 'session_key')
    
    readonly_fields = ('session_key', 'created_at', 'last_activity', 'get_duration')
    
    list_per_page = 50
    
    def user_link(self, obj):
        if obj.user:
            return format_html(
                '<a href="/admin/accounts/user/{}/">{}</a>',
                obj.user.id, obj.user.username
            )
        return "—"
    user_link.short_description = 'Пользователь'
    
    def session_key_short(self, obj):
        if obj.session_key:
            return f"{obj.session_key[:10]}..."
        return "—"
    session_key_short.short_description = 'Session Key'
    
    def user_agent_short(self, obj):
        if obj.user_agent:
            return obj.user_agent[:50] + "..." if len(obj.user_agent) > 50 else obj.user_agent
        return "—"
    user_agent_short.short_description = 'User Agent'
    
    def get_duration(self, obj):
        return obj.get_duration()
    get_duration.short_description = 'Длительность'
    
    actions = ['terminate_sessions']
    
    def terminate_sessions(self, request, queryset):
        queryset.update(is_active=False)
        self.message_user(request, f"{queryset.count()} сессий завершено")
    terminate_sessions.short_description = "Завершить выбранные сессии"


# Добавляем inline для отображения сессий в профиле пользователя
class UserSessionInline(admin.TabularInline):
    model = UserSession
    extra = 0
    fields = ('session_key_short', 'ip_address', 'created_at', 'last_activity', 'is_active')
    readonly_fields = ('session_key_short', 'ip_address', 'created_at', 'last_activity')
    can_delete = False
    max_num = 10
    
    def session_key_short(self, obj):
        return f"{obj.session_key[:10]}..." if obj.session_key else "—"
    session_key_short.short_description = 'Session Key'

# Добавляем inline к админке пользователя
CustomUserAdmin.inlines = [UserSessionInline]