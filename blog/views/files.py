from __future__ import absolute_import, unicode_literals
from django.http import HttpResponse
from django.core.files.uploadedfile import SimpleUploadedFile
from annoying.decorators import render_to
from cekolabs.blog import forms, models
import cekolabs.core.utils
from django.views.decorators.csrf import csrf_exempt
import base64
import json
from django.contrib.auth.decorators import login_required
from django.core import serializers


@login_required
@render_to('blog/files/manager.html')
def manager(request):
    return {}

@login_required
@csrf_exempt    
def upload_ajax(request):    
    file_name = request.POST['name']
    file_data = base64.b64decode(request.POST['data'])
    upload_files = { 'file' : SimpleUploadedFile(file_name, file_data) } 
        
    blog_file_form = forms.BlogFile(request.POST,upload_files)    
    blog_file = blog_file_form.save()
    serialized_file = cekolabs.core.utils.SmartJSONSerializer().serialize_model(blog_file, ['formatted_size', 'formatted_date', 'id', 'url',])
     
    #import pdb;pdb.set_trace()    
    response = {
        'status' : 'success',
        'file_name' : blog_file.file.name,
        'files' : json.loads(serialized_file) #so hacky 
    }

    return HttpResponse(json.dumps(response), mimetype="application/json")

@login_required
@csrf_exempt
def search(request, term):
    search_start = int(request.GET.get('start', 0))
    files = models.BlogFile.objects.all()
    if term:
        files = files.filter(file__icontains=term) 
    files = files.order_by('-upload_date')[search_start:search_start + 20]
        
    return HttpResponse(cekolabs.core.utils.SmartJSONSerializer().serialize(files, ['formatted_size', 'formatted_date', 'id', 'url',]), mimetype="application/json")             