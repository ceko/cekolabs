from __future__ import absolute_import, unicode_literals
from django.http import HttpResponse
from annoying.decorators import render_to
from cekolabs.blog import models as blog_models


@render_to('home.html')
def home(request):
    latest_posts = blog_models.Post.objects.filter(published=True).order_by('-last_modified').all()[:5]
    return locals()

@render_to('django-form-architect/index.html')
def django_form_architect(request):
    return {}

@render_to('resume.html')
def resume(request):
    return {}

@render_to('ksp-mods.html')
def ksp_mods(request):
    return {}
