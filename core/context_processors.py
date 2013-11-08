from django.http import HttpResponse
from django.template import RequestContext
from cekolabs.core.models import Feature, Project


def features(request):
    return {'features': Feature.objects.all().filter(is_active = True).order_by('-created')}

def projects(request):
    return {'projects': Project.objects.all().filter(is_active = True)}