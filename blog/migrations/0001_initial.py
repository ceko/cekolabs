# -*- coding: utf-8 -*-
import datetime
from south.db import db
from south.v2 import SchemaMigration
from django.db import models


class Migration(SchemaMigration):

    def forwards(self, orm):
        # Adding model 'Tag'
        db.create_table('blog_tag', (
            ('name', self.gf('django.db.models.fields.CharField')(max_length=50, primary_key=True)),
        ))
        db.send_create_signal('blog', ['Tag'])

        # Adding model 'Post'
        db.create_table('blog_post', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('slug', self.gf('django.db.models.fields.SlugField')(default='', max_length=50)),
            ('markdown', self.gf('django.db.models.fields.TextField')(default='')),
            ('published', self.gf('django.db.models.fields.BooleanField')(default=False)),
            ('featured', self.gf('django.db.models.fields.BooleanField')(default=False)),
        ))
        db.send_create_signal('blog', ['Post'])

        # Adding M2M table for field tags on 'Post'
        db.create_table('blog_post_tags', (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('post', models.ForeignKey(orm['blog.post'], null=False)),
            ('tag', models.ForeignKey(orm['blog.tag'], null=False))
        ))
        db.create_unique('blog_post_tags', ['post_id', 'tag_id'])

        # Adding model 'BlogFile'
        db.create_table('blog_blogfile', (
            ('id', self.gf('django.db.models.fields.AutoField')(primary_key=True)),
            ('file', self.gf('django.db.models.fields.files.FileField')(max_length=100)),
            ('upload_date', self.gf('django.db.models.fields.DateTimeField')(auto_now_add=True, blank=True)),
            ('byte_size', self.gf('django.db.models.fields.IntegerField')()),
        ))
        db.send_create_signal('blog', ['BlogFile'])

        # Adding M2M table for field tags on 'BlogFile'
        db.create_table('blog_blogfile_tags', (
            ('id', models.AutoField(verbose_name='ID', primary_key=True, auto_created=True)),
            ('blogfile', models.ForeignKey(orm['blog.blogfile'], null=False)),
            ('tag', models.ForeignKey(orm['blog.tag'], null=False))
        ))
        db.create_unique('blog_blogfile_tags', ['blogfile_id', 'tag_id'])


    def backwards(self, orm):
        # Deleting model 'Tag'
        db.delete_table('blog_tag')

        # Deleting model 'Post'
        db.delete_table('blog_post')

        # Removing M2M table for field tags on 'Post'
        db.delete_table('blog_post_tags')

        # Deleting model 'BlogFile'
        db.delete_table('blog_blogfile')

        # Removing M2M table for field tags on 'BlogFile'
        db.delete_table('blog_blogfile_tags')


    models = {
        'blog.blogfile': {
            'Meta': {'object_name': 'BlogFile'},
            'byte_size': ('django.db.models.fields.IntegerField', [], {}),
            'file': ('django.db.models.fields.files.FileField', [], {'max_length': '100'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'tags': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['blog.Tag']", 'symmetrical': 'False'}),
            'upload_date': ('django.db.models.fields.DateTimeField', [], {'auto_now_add': 'True', 'blank': 'True'})
        },
        'blog.post': {
            'Meta': {'object_name': 'Post'},
            'featured': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'id': ('django.db.models.fields.AutoField', [], {'primary_key': 'True'}),
            'markdown': ('django.db.models.fields.TextField', [], {'default': "''"}),
            'published': ('django.db.models.fields.BooleanField', [], {'default': 'False'}),
            'slug': ('django.db.models.fields.SlugField', [], {'default': "''", 'max_length': '50'}),
            'tags': ('django.db.models.fields.related.ManyToManyField', [], {'to': "orm['blog.Tag']", 'symmetrical': 'False'})
        },
        'blog.tag': {
            'Meta': {'object_name': 'Tag'},
            'name': ('django.db.models.fields.CharField', [], {'max_length': '50', 'primary_key': 'True'})
        }
    }

    complete_apps = ['blog']