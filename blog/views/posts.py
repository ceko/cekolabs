from __future__ import absolute_import, unicode_literals
from django.http import HttpResponse
from annoying.decorators import render_to
from cekolabs.blog import forms, models, markdown_extensions
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import redirect, get_object_or_404
from django.contrib import messages
from django.contrib.auth.decorators import login_required
import markdown
import json
import itertools
import datetime


@render_to('blog/view.html')
def view(request, id):
    post = get_object_or_404(models.Post, id = id)    
    recent_posts = models.Post.objects.all().order_by('-created')[:5]
        
    return {
        'post' : post,
        'parsed_markdown' : post.parsed_markdown(),
        'recent_posts' : recent_posts,
    }

@login_required(login_url = '/admin/')
@render_to('blog/edit.html')
def new(request):
    post_form = None
    if request.method == 'POST':
        post_form = forms.Post(request.POST, request.FILES)
        if post_form.is_valid():
            post = post_form.save()
            
            messages.add_message(request, messages.SUCCESS, 'The blog post was successfully added.')
            return redirect('list')
    else:
        post_form = forms.Post()
    
    return {
        'post_form' : post_form         
    }
    
@login_required(login_url = '/admin/')
@render_to('blog/edit.html')
def edit(request, id):
    post = get_object_or_404(models.Post, id = id)
    post_form = None
    if request.method == 'POST':
        post_form = forms.Post(request.POST, request.FILES, instance=post)
        if post_form.is_valid():
            post = post_form.save()
            
            messages.add_message(request, messages.SUCCESS, 'The blog post was successfully updated.')
            return redirect('list_entries')
    else:
        post_form = forms.Post(instance=post)
    
    return {
        'post_form' : post_form,
        'post' : post
    }    

@render_to('blog/tagsearch.html')
def tagsearch(request, tags):
    return {}

@render_to('blog/list.html')
def list_entries(request):
    #eventually i'll need to limit this
    posts = models.Post.objects.all().filter(published = True)
    #arrange into groups by month
    posts_by_month = itertools.groupby(posts, lambda p: str(p.created.year) + ' ' + str(p.created.month))
    posts_by_month_keyed = [{'date' : datetime.date(int(p[0].split(' ')[0]), int(p[0].split(' ')[1]), 1), 'posts': list(p[1])} for p in posts_by_month]

    return {
        'grouped_posts' : posts_by_month_keyed
    }

@login_required(login_url = '/admin/')    
@csrf_exempt      
def parse_markdown(request):
    raw_markdown = request.POST.get('text', '')
    pretty_print_ext = markdown_extensions.PrettyPrintExtension()
    attribute_stack_ext = markdown_extensions.AttributeStackExtension()
    html = markdown.markdown(raw_markdown, extensions=['tables', pretty_print_ext, attribute_stack_ext])
    
    response = {
        'status' : 'success',
        'html' : html
    }

    return HttpResponse(json.dumps(response), mimetype="application/json") 