# -*- coding: utf-8 -*-
from __future__ import division
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models
from django.db.transaction import commit_on_success


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding field 'OffensiveModeAttributes.health_per_second'
        db.add_column(u'core_offensivemodeattributes', 'health_per_second',
                      self.gf('django.db.models.fields.DecimalField')(default=0, max_digits=6, decimal_places=2),
                      keep_default=False)
        self.set_hps(orm)

    @commit_on_success
    def set_hps(self, orm):
        omode_attributes = orm['core.offensivemodeattributes'].objects.all().select_related('round')
        total = omode_attributes.count()
        pos = 1
        
        for m in omode_attributes:
            print 'updating ' + str(pos) + ' of ' + str(total)
            pos+=1
            total_time_to_complete = max([h.time_to_complete for h in m.round.trainercombohistory_set.all()] or [0,])
            
            if total_time_to_complete <> 0:
                m.health_per_second = m.enemy_health / float(total_time_to_complete) * 1000.0
                m.save()
            
    def backwards(self, orm):
        # Deleting field 'OffensiveModeAttributes.health_per_second'
        db.delete_column(u'core_offensivemodeattributes', 'health_per_second')


    models = {
        u'blog.post': {
            'Meta': {'ordering': "['-created']", 'object_name': 'Post'},
            'created': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'featured': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'last_modified': ('django.db.models.fields.DateTimeField', [], {'auto_now': 'True', 'blank': 'True'}),
            'markdown': ('django.db.models.fields.TextField', [], {'default': "''"}),
            'published': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'slug': ('django.db.models.fields.SlugField', [], {'default': "''", 'max_length': '50'}),
            'tags': ('django.db.models.fields.related.ManyToManyField', [], {'to': u"orm['blog.Tag']", 'symmetrical': 'False'}),
            'teaser': ('django.db.models.fields.TextField', [], {'default': "''"}),
            'teaser_image': ('django.db.models.fields.files.FileField', [], {'max_length': '100', 'null': 'True'}),
            'title': ('django.db.models.fields.CharField', [], {'default': "''", 'max_length': '255'})
        },
        u'blog.tag': {
            'Meta': {'object_name': 'Tag'},
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50', 'primary_key': 'True'})
        },
        u'core.comboelement': {
            'Meta': {'object_name': 'ComboElement'},
            'combo': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['core.TrainerComboHistory']"}),
            'element': ('django.db.models.fields.CharField', [], {'max_length': '10'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'})
        },
        u'core.feature': {
            'Meta': {'object_name': 'Feature'},
            'created': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'description': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'image': ('django.db.models.fields.files.FileField', [], {'max_length': '100'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'}),
            'post': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['blog.Post']"})
        },
        u'core.offensivemodeattributes': {
            'Meta': {'object_name': 'OffensiveModeAttributes'},
            'enemy_health': ('django.db.models.fields.IntegerField', [], {}),
            'health_per_second': ('django.db.models.fields.DecimalField', [], {'max_digits': '5', 'decimal_places': '1'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'round': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['core.TrainerRoundHistory']"}),
            'spell_delay_modifier': ('django.db.models.fields.DecimalField', [], {'max_digits': '4', 'decimal_places': '2'})
        },
        u'core.project': {
            'Meta': {'object_name': 'Project'},
            'created': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'}),
            'description': ('django.db.models.fields.CharField', [], {'max_length': '255'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'is_active': ('django.db.models.fields.BooleanField', [], {'default': 'True'}),
            'link': ('django.db.models.fields.URLField', [], {'max_length': '200'}),
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50'})
        },
        u'core.trainercombohistory': {
            'Meta': {'object_name': 'TrainerComboHistory'},
            'fumbled': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'round': ('django.db.models.fields.related.ForeignKey', [], {'to': u"orm['core.TrainerRoundHistory']"}),
            'time_to_complete': ('django.db.models.fields.IntegerField', [], {})
        },
        u'core.trainerroundhistory': {
            'Meta': {'object_name': 'TrainerRoundHistory'},
            u'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'leaderboard_name': ('django.db.models.fields.CharField', [], {'max_length': '30', 'null': 'True', 'blank': 'True'}),
            'mode': ('django.db.models.fields.CharField', [], {'max_length': '1'}),
            'submitted_by': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39'}),
            'submitted_on': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'})
        }
    }

    complete_apps = ['core']