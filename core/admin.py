from django.contrib import admin
from cekolabs.core import models
from django import forms

class TrainerComboHistoryForm(forms.ModelForm):
    
    class Meta:
        model = models.TrainerComboHistory

class TrainerComboHistoryAdmin(admin.TabularInline):
    model = models.TrainerComboHistory
    form = TrainerComboHistoryForm

    readonly_fields = ('time_to_complete','fumbled')

    def has_add_permission(self, request, obj=None):
        return False
        

class TrainerRoundHistoryAdmin(admin.ModelAdmin):
    list_display = ['submitted_on', 'submitted_by', 'queues_completed']
    inlines = [
        TrainerComboHistoryAdmin        
    ]
    
    def queues_completed(self, model):
        return models.TrainerComboHistory.objects.filter(round = model).count()
    
    def has_add_permission(self, request, obj=None):
        return False

admin.site.register(models.Feature)
admin.site.register(models.Project)
admin.site.register(models.ComboElement)
admin.site.register(models.TrainerComboHistory)
admin.site.register(models.TrainerRoundHistory, TrainerRoundHistoryAdmin)