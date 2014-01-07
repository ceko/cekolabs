from django.db import models
from cekolabs.blog.models import Post


class Feature(models.Model):   
    created = models.DateTimeField(auto_now_add=True) 
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    post = models.ForeignKey(Post)
    image = models.FileField(upload_to='features/')
    is_active = models.BooleanField(default=True)

class Project(models.Model):    
    created = models.DateTimeField(auto_now_add=True) 
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    link = models.URLField()
    is_active = models.BooleanField(default=True)
    
class TrainerRoundHistory(models.Model):
    MODE_CHOICES = (
        ('Q', 'QUEUE'),
        ('D', 'DEQUEUE')
    )
    
    submitted_on = models.DateTimeField(auto_now_add=True)
    submitted_by = models.GenericIPAddressField()
    mode = models.CharField(max_length=1, choices=MODE_CHOICES)

class TrainerComboHistory(models.Model):        
    round = models.ForeignKey(TrainerRoundHistory)
    time_to_complete = models.IntegerField()
    fumbled = models.BooleanField()
    
    def __str__(self):        
        return ", ".join(e.element for e in ComboElement.objects.filter(combo=self))
    
class ComboElement(models.Model):
    ELEMENT_CHOICES = ((e,e) for e in (
        'water',
        'life',
        'shield',
        'cold',
        'lightning',
        'arcane',
        'earth',
        'fire'
    ))
    
    combo = models.ForeignKey(TrainerComboHistory)
    element = models.CharField(max_length=10, choices = ELEMENT_CHOICES)    