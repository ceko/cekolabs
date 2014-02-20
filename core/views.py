from __future__ import absolute_import, unicode_literals
from django.http import HttpResponse, HttpResponseRedirect
from annoying.decorators import render_to
from cekolabs.blog import models as blog_models
from django.views.decorators.csrf import ensure_csrf_cookie
import json
from cekolabs.core import models as core_models
from django.db.models import Count, Sum, Avg


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
    return { }

@render_to('misc/finch.html')
def finch(request):
    return { }

def magicka_trainer_redirect(request):
    return HttpResponseRedirect('/trainer')

@ensure_csrf_cookie
@render_to('misc/finch-trainer.html')
def magicka_trainer(request):
    return { }

@ensure_csrf_cookie
def magicka_trainer_save_history(request):    
    history = json.loads(request.POST.get('history'))
    label = json.loads(request.POST.get('label'))
    additional_attributes = json.loads(request.POST.get('additional_attributes'))
    leaderboard_name = request.POST.get('leaderboard_name')
    
    round_history = core_models.TrainerRoundHistory()
    round_history.leaderboard_name = leaderboard_name
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
        offensive_mode_stats.enemy_health = additional_attributes['enemy_health']
        offensive_mode_stats.spell_delay_modifier = additional_attributes['spell_delay_modifier']
        offensive_mode_stats.save()    
            
    return HttpResponse(json.dumps({ 'status': 'success', 'id': round_history.id }))   

def get_leaderboard_query(mode):
    history = core_models.TrainerRoundHistory.objects \
            .annotate(total_rounds = Count('trainercombohistory')) \
            .annotate(average_time_to_complete = Avg('trainercombohistory__time_to_complete')) \
            .annotate(total_time_to_complete = Sum('trainercombohistory__time_to_complete')) \
            .order_by('average_time_to_complete')
            
    if mode == 'queue':
        history = history.filter(total_rounds__gte = 10, mode = 'Q') 
    elif mode == 'dequeue':
        history = history.filter(total_rounds__gte = 10, mode = 'D')
    elif mode == 'offensive':
        history = history.filter(mode = 'O')

    return history

def magicka_trainer_leaderboard(request, mode, round_id):
    if not round_id:
        round_id = 0        
    round_id = int(round_id)
        
    response = {
        'rounds': [],
        'total': 0
    }
    history = get_leaderboard_query(mode)
        
    round_id_found = True if round_id == 0 else False  
    for round in history[:10]:
        if round.id == round_id:            
            round_id_found = True
            
        response['rounds'].append({
            'id': round.id,
            'average_time_to_complete': round.average_time_to_complete,
            'total_time_to_complete': round.total_time_to_complete,
            'total_rounds': round.total_rounds,
            'name': round.leaderboard_name
        })
        
    if not round_id_found:
        my_history = get_leaderboard_query(mode).filter(id=round_id);
        if len(my_history) == 1:
            #this is only good for queue and dequeue mode
            better_rounds = get_leaderboard_query(mode).filter(average_time_to_complete__lt = my_history[0].average_time_to_complete).count()
            response['rounds'].append({
                'id': my_history[0].id,
                'place': better_rounds+1,
                'average_time_to_complete': my_history[0].average_time_to_complete,
                'total_time_to_complete': my_history[0].total_time_to_complete,
                'total_rounds': my_history[0].total_rounds,
                'name': my_history[0].leaderboard_name
            })
    
    all_history_count = get_leaderboard_query(mode).count()
    response['total'] = all_history_count
    
    return HttpResponse(json.dumps(response))

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0]
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip 