from __future__ import absolute_import, unicode_literals
from django.http import HttpResponse
from django.db.models import Count
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


@render_to('misc/finch.html')
def finch(request):
    return { }

@render_to('misc/finch-trainer.html')
def finch_trainer(request):
    return { }