from django.contrib import admin
from cekolabs.blog import models

admin.site.register(models.BlogFile)
admin.site.register(models.Post)
admin.site.register(models.Tag)