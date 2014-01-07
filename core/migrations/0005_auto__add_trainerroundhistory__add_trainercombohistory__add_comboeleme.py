# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'TrainerRoundHistory'
        db.create_table(u'core_trainerroundhistory', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('submitted_on', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
            ('submitted_by', self.gf('django.db.models.fields.GenericIPAddressField')(max_length=39)),
            ('mode', self.gf('django.db.models.fields.CharField')(max_length=1)),
        ))
        db.send_create_signal(u'core', ['TrainerRoundHistory'])

        # Adding model 'TrainerComboHistory'
        db.create_table(u'core_trainercombohistory', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('round', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['core.TrainerRoundHistory'])),
            ('time_to_complete', self.gf('django.db.models.fields.IntegerField')()),
            ('fumbled', self.gf('django.db.models.fields.BooleanField')(default=False)),
        ))
        db.send_create_signal(u'core', ['TrainerComboHistory'])

        # Adding model 'ComboElement'
        db.create_table(u'core_comboelement', (
            (u'id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('combo', self.gf('django.db.models.fields.related.ForeignKey')(to=orm['core.TrainerComboHistory'])),
            ('element', self.gf('django.db.models.fields.CharField')(max_length=10)),
        ))
        db.send_create_signal(u'core', ['ComboElement'])


    def backwards(self, orm):
        # Deleting model 'TrainerRoundHistory'
        db.delete_table(u'core_trainerroundhistory')

        # Deleting model 'TrainerComboHistory'
        db.delete_table(u'core_trainercombohistory')

        # Deleting model 'ComboElement'
        db.delete_table(u'core_comboelement')


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
            'mode': ('django.db.models.fields.CharField', [], {'max_length': '1'}),
            'submitted_by': ('django.db.models.fields.GenericIPAddressField', [], {'max_length': '39'}),
            'submitted_on': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'})
        }
    }

    complete_apps = ['core']