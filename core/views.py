from __future__ import absolute_import, unicode_literals
from annoying.decorators import render_to
from cekolabs.blog import models as blog_models
from cekolabs.core import models as core_models, utils, utils
from datetime import date, datetime, timedelta
from django.conf import settings
from django.core.serializers.json import DjangoJSONEncoder
from django.db import connection
from django.db.models import Count, Sum, Avg, Max, Min, F
from django.http import HttpResponse, HttpResponseRedirect
from django.views.decorators.csrf import ensure_csrf_cookie
import cekolabs.core.empanada
import cekolabs_empanada
import json
import os
import random
import time


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

def error_500(request):
    return HttpResponse('error')

@render_to('misc/particle-effect-builder.html')
def particle_effect_builder(request):
    return {}

def empanada(request):
    template_path = os.path.join(settings.PROJECT_ROOT, 'core/templates/empanada/index.html')
    content = cekolabs_empanada.render(template_path, {
        'request': request,
        'settings': settings,
        'second' : False,
        'third' : 'You got it'        
    })
        
    return HttpResponse(content)

@render_to('misc/finch.html')
def finch(request):
    return {}

def magicka_trainer_redirect(request):
    return HttpResponseRedirect('/trainer')

@ensure_csrf_cookie
@render_to('misc/finch-trainer.html')
def magicka_trainer(request):
    return {}

@ensure_csrf_cookie
def magicka_trainer_save_history(request):    
    history = json.loads(request.POST.get('history'))
    label = json.loads(request.POST.get('label'))
    additional_attributes = json.loads(request.POST.get('additional_attributes'))
    leaderboard_name = request.POST.get('leaderboard_name')
    sec_tokens = json.loads(request.POST.get('tokens'))
    
    leaderboard_country = request.POST.get("leaderboard_country")
    if leaderboard_country and len(leaderboard_country) == 0:
        leaderboard_country = None
    
    round_history = core_models.TrainerRoundHistory()
    round_history.leaderboard_name = leaderboard_name
    round_history.country_code = leaderboard_country
    try:
        round_history.round_check_start = float(utils.vigenere('my_pasta', sec_tokens[0], 'decrypt')) / 10000.0
        if len(sec_tokens) > 1:
            round_history.round_check_end = float(utils.vigenere('my_pasta', sec_tokens[1], 'decrypt')) / 10000.0
        else:
            round_history.round_check_end = time.time()
    except Exception as e:
        round_history.flag_for_review = True
        
    #oops
    if label == 'olympic':
        round_history.mode = 'M'
    else:    
        round_history.mode = label[0].upper()
    round_history.submitted_by = get_client_ip(request)
    round_history.save()
    
    for entry in history:
        combo = core_models.TrainerComboHistory()
        combo.fumbled = entry['fumble']
        combo.round = round_history
        combo.time_to_complete = entry['time_to_complete']
        
        combo.save()
        for element in entry['element_queue']:
            combo_element = core_models.ComboElement()
            combo_element.combo = combo
            combo_element.element = element
            combo_element.save()
     
    #offensive mode
    if round_history.mode == 'O':
        offensive_mode_stats = core_models.OffensiveModeAttributes()
        offensive_mode_stats.round = round_history
        offensive_mode_stats.enemy_health = int(additional_attributes['enemy_health'])
        offensive_mode_stats.spell_delay_modifier = float(additional_attributes['spell_delay_modifier'])
        offensive_mode_stats.save()    
    elif round_history.mode == 'M':
        olympic_mode_stats = core_models.OlympicModeAttributes()
        olympic_mode_stats.round = round_history
        olympic_mode_stats.round_length = round_history.normalized_time_to_complete()
        olympic_mode_stats.save()
     
    if round_history.round_check_end and round_history.round_check_start:
        #simple check to see if they're cheating, obviously not foolproof
        check_diff_ms = (round_history.round_check_end - round_history.round_check_start) * 1000    
        if  abs(check_diff_ms - round_history.normalized_time_to_complete()) / float(check_diff_ms) > .05:
            round_history.flag_for_review = True
            round_history.save()
            
    return HttpResponse(json.dumps({ 'status': 'success', 'id': round_history.id }))   

def get_leaderboard_query(mode, timeframe):
    history = core_models.TrainerRoundHistory.objects 
    
    if timeframe == 'weekly':
        history = history.filter(submitted_on__gte = date.today()-timedelta(days=7))
    elif timeframe == 'monthly':
        history = history.filter(submitted_on__gte = date.today()-timedelta(days=30))
    elif timeframe == 'olympic':
        history = history.filter(submitted_on__gte = datetime(2014, 2, 23), submitted_on__lte = datetime(2014, 3, 1))
    
    history = history.annotate(total_rounds = Count('trainercombohistories')) \
        .annotate(average_time_to_complete = Avg('trainercombohistories__time_to_complete')) 
        
    submode = None    
    if "-" in mode:
        mode, submode = mode.split('-')
            
    if mode == 'queue':
        history = history \
            .filter(total_rounds__gte = 10, mode = 'Q') \
            .annotate(total_time_to_complete = Sum('trainercombohistories__time_to_complete')) \
            .order_by('average_time_to_complete')
    elif mode == 'dequeue':
        history = history \
            .filter(total_rounds__gte = 10, mode = 'D') \
            .order_by('average_time_to_complete')
    elif mode == 'offensive':        
        history = history.filter(mode = 'O') \
            .annotate(hps=Max('offensivemodeattributes__health_per_second')) \
            .annotate(null_hps=Count('offensivemodeattributes__id', distinct=True)) \
            .annotate(spell_delay_modifier=Max('offensivemodeattributes__spell_delay_modifier')) \
            .annotate(total_time_to_complete = Sum('trainercombohistories__time_to_complete')) \
            .order_by('-null_hps', '-hps')
                    
        if submode == 'easy':
            history = history.filter(spell_delay_modifier = 2)
        elif submode == 'normal':
            history = history.filter(spell_delay_modifier = 1.25)
        elif submode == 'hard':
            history = history.filter(spell_delay_modifier = .75)
            
    elif mode == 'olympic':        
        history = history \
            .filter(mode = 'M')
        
        #roll up users so people don't end up dominating the boards.
        """grouped_users = history.all() \
            .extra(
                select={
                    'round_id': 'SELECT MAX(round_id) FROM (SELECT round_id FROM "core_olympicmodeattributes" ai INNER JOIN "core_trainerroundhistory" hi ON ai.round_id = hi.id WHERE hi.leaderboard_name = "core_trainerroundhistory"."leaderboard_name" AND hi.submitted_by = "core_trainerroundhistory"."submitted_by" ORDER BY ai.round_length ASC LIMIT 1) as rli',
                }
            ) \
            .values('leaderboard_name', 'submitted_by', 'round_id') \
            .annotate(total_time_to_complete = Min('olympicmodeattributes__round_length'))
        """
        cursor = connection.cursor()
        grouped_users = cursor.execute("""
    WITH submissions as (
  SELECT    
     count(*) as "total_rounds",
     coalesce(leaderboard_name, '') as "leaderboard_name",
     submitted_by
  FROM 
     core_trainerroundhistory trh 
  INNER JOIN core_olympicmodeattributes oma ON trh.id = oma.round_id 
  GROUP BY leaderboard_name, submitted_by
)

SELECT   
  (SELECT MAX(round_id) FROM (SELECT round_id FROM core_trainerroundhistory trh INNER JOIN core_olympicmodeattributes oma ON oma.round_id = trh.id WHERE trh.mode = 'M' AND coalesce(trh.leaderboard_name,'') = submissions.leaderboard_name AND trh.submitted_by = submissions.submitted_by ORDER BY oma.round_length ASC LIMIT 1) as ri) as "round_id" FROM submissions
""")
        round_ids = cursor.fetchall()
        
        history = history.filter(id__in = [r[0] for r in round_ids if r[0]]) \
            .annotate(total_time_to_complete = Max('olympicmodeattributes__round_length')) \
            .extra(
                select={
                    'total_submissions': 'SELECT COUNT(*) FROM "core_trainerroundhistory" cth INNER JOIN "core_olympicmodeattributes" ai ON cth.id = ai.round_id WHERE cth.leaderboard_name = "core_trainerroundhistory"."leaderboard_name" AND cth.submitted_by = "core_trainerroundhistory"."submitted_by"'
                }
            ) \
            .order_by('total_time_to_complete')
        
    history = history.prefetch_related('trainercombohistories')
        
    return history

@render_to('home.html')
def magicka_trainer_leaderboard(request, mode, timeframe, round_id):
    if not round_id:
        round_id = 0
    round_id = int(round_id)
        
    response = {
        'rounds': [],
        'total': 0
    }
    history = get_leaderboard_query(mode, timeframe)
        
    round_id_found = True if round_id == 0 else False  
    for round in history[:50]:
        if round.id == round_id:            
            round_id_found = True
            
        round_dict = {
            'id': round.id,
            'average_time_to_complete': round.average_time_to_complete,
            'total_time_to_complete': round.normalized_time_to_complete(),
            'total_rounds': round.total_rounds,
            'name': round.leaderboard_name,
            'country': round.country_code,
        }
        
        if round.mode == 'O':            
            round_dict['hps'] = round.hps
        elif round.mode == 'M':
            round_dict['total_submissions'] = round.total_submissions
        
        response['rounds'].append(round_dict)
        
        
    if not round_id_found:
        my_history = get_leaderboard_query(mode, timeframe).filter(id=round_id);
        if len(my_history) == 1:
            #this is only good for queue and dequeue mode
            if mode.startswith('offensive'):
                better_rounds = get_leaderboard_query(mode, timeframe).filter(hps__gt = my_history[0].hps)                
            elif mode == 'olympic':
                better_rounds = get_leaderboard_query(mode, timeframe).filter(total_time_to_complete__lt = my_history[0].normalized_time_to_complete())
            else:
                better_rounds = get_leaderboard_query(mode, timeframe).filter(average_time_to_complete__lt = my_history[0].average_time_to_complete)
            
            better_rounds = better_rounds.count()
            round_dict = {
                'id': my_history[0].id,
                'place': better_rounds+1,
                'average_time_to_complete': my_history[0].average_time_to_complete,
                'total_time_to_complete': my_history[0].normalized_time_to_complete(),
                'total_rounds': my_history[0].total_rounds,
                'name': my_history[0].leaderboard_name,
                'country': my_history[0].country_code
            }
            if round.mode == 'O':            
                round_dict['hps'] = my_history[0].hps
            elif round.mode == 'M':
                round_dict['total_submissions'] = my_history[0].total_submissions
                
            response['rounds'].append(round_dict)
                        
    
    all_history_count = get_leaderboard_query(mode, timeframe).count()
    response['total'] = all_history_count
    #return {}    
    return HttpResponse(json.dumps(response, cls=DjangoJSONEncoder))

def get_encoded_server_time(request):
    return HttpResponse(json.dumps({ 'token': utils.vigenere('my_pasta', str(int(time.time()*10000)), 'encrypt') }))

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip 
