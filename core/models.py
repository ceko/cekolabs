from django.db import models


class Feature(models.Model):   
    created = models.DateTimeField(auto_now_add=True) 
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    link = models.URLField()    
    image = models.FileField(upload_to='features/')
    is_active = models.BooleanField(default=True)

class Project(models.Model):    
    created = models.DateTimeField(auto_now_add=True) 
    name = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    link = models.URLField()
    is_active = models.BooleanField(default=True)  