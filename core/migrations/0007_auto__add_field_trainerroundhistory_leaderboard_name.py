# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding field 'TrainerRoundHistory.leaderboard_name'
        db.add_column(u'core_trainerroundhistory', 'leaderboard_name',
                      self.gf('django.db.models.fields.CharField')(max_length=30, null=True, blank=True),
                      keep_default=False)


    def backwards(self, orm):
        # Deleting field 'TrainerRoundHistory.leaderboard_name'
        db.delete_column(u'core_trainerroundhistory', 'leaderboard_name')


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