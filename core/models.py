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
        ('O', 'OFFENSIVE'),
        ('Q', 'QUEUE'),
        ('D', 'DEQUEUE'),
        ('M', 'MARATHON'),
    )
        
    submitted_on = models.DateTimeField(auto_now_add=True)
    submitted_by = models.GenericIPAddressField()
    leaderboard_name = models.CharField(max_length=30, null=True, blank=True)
    mode = models.CharField(max_length=1, choices=MODE_CHOICES)

    def normalized_time_to_complete(self):        
        if self.mode == 'O':            
            length = len(self.trainercombohistories.all())
                        
            if length:
                return self.trainercombohistories.all()[length-1].time_to_complete
            else:
                return -1
        elif self.mode == 'M':
            total_time = 0
            try:                
                for i in range(0,20):                    
                    total_time += self.trainercombohistories.all()[i].time_to_complete
                total_time += self.trainercombohistories.all()[len(self.trainercombohistories.all())-1].time_to_complete
            except Exception as e:
                total_time = -1 
            
            return total_time
        else:
            return sum([h.time_to_complete for h in self.trainercombohistories.all()])

class TrainerComboHistory(models.Model):        
    round = models.ForeignKey(TrainerRoundHistory, related_name='trainercombohistories')
    time_to_complete = models.IntegerField()
    fumbled = models.BooleanField()
    
    def __str__(self):        
        return ", ".join(e.element for e in ComboElement.objects.filter(combo=self))
    
    class Meta:
        ordering = ['id',]
    
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

class OffensiveModeAttributes(models.Model):
    round = models.ForeignKey(TrainerRoundHistory)
    spell_delay_modifier = models.DecimalField(max_digits = 4, decimal_places = 2)
    enemy_health = models.IntegerField()
    health_per_second = models.DecimalField(max_digits = 6, decimal_places = 2)
        
    def save(self, *args, **kwargs):        
        total_time_to_complete = max([h.time_to_complete for h in self.round.trainercombohistories.all()] or [0,])
        if total_time_to_complete <> 0:
            self.health_per_second = self.enemy_health / float(total_time_to_complete) * 1000.0
             
        super(OffensiveModeAttributes, self).save(*args, **kwargs)