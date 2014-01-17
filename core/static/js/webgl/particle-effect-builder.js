

var models = {
	Renderer: Backbone.Model.extend({
		gl_blend_options: [
		     'ZERO',
		     'ONE',
		     'SRC_COLOR',
		     'ONE_MINUS_SRC_COLOR',
		     'DST_COLOR',
		     'ONE_MINUS_DST_COLOR',
		     'SRC_ALPHA',
		     'ONE_MINUS_SRC_ALPHA',
		     'DST_ALPHA',
		     'ONE_MINUS_DST_ALPHA',
		     'CONSTANT_COLOR',
		     'ONE_MINUS_CONSTANT_COLOR',
		     'CONSTANT_ALPHA',
		     'ONE_MINUS_CONSTANT_ALPHA',
		     'SRC_ALPHA_SATURATE',
		     'SRC1_COLOR',
		     'ONE_MINUS_SRC1_COLOR',
		     'SRC1_ALPHA',
		     'ONE_MINUS_SRC1_ALPHA'
		],
		initialize: function() {
			this.view = particle_tester.views.renderer;
			var proton = new Proton();
			var renderer = new Proton.Renderer('webgl', proton, this.view.$el.get(0));			
			renderer.start();
			this.set('src_blend', 'SRC_ALPHA');
			this.set('dst_blend', 'ONE');
			renderer.blendFunc("SRC_ALPHA", "ONE");
			
			this.set({
				emitters: [],
				proton: proton,
				renderer: renderer,
			});
			this.render_loop();
		},
		set_src_blend: function(blend_mode) {
			this.set('src_blend', blend_mode);
			this.get('renderer').blendFunc(blend_mode, this.get('dst_blend'));
		},
		set_dst_blend: function(blend_mode) {
			this.set('dst_blend', blend_mode);
			this.get('renderer').blendFunc(this.get('src_blend'), blend_mode);
		},
		render_loop: function() {
			this.get('proton').update();
			requestAnimationFrame(this.render_loop.bind(this));
		},
		add_emitter: function(emitter) {
			var emitters = this.get('emitters');
			emitters.push(emitter);
			
			emitter.p.x = this.view.$el.get(0).width / 2;
			emitter.p.y = this.view.$el.get(0).height / 2;
			
			this.set('emitters', emitters);
			this.get('proton').addEmitter(emitter);
			this.trigger('change:emitters');			
		}
	}),
	ParticleSettings: Backbone.Model.extend({
		initialize: function() {
			this.set({
				'emitter': null,
				'behaviors': [],
			});
			
			this.set_count(min=5, max=10, interval=.1);
			this.set_image_target('/static/images/finch/particle.png');
			this.set_radius(min=2, max=5);
			this.set_life(min=4, max=5);
			this.set_velocity(rpan_min=.5, rpan_max=1.5, thapan_initial=0, thapan_drift=360);
			
			this.add_behavior('color', {initial: '#FF0000', end: '#FFFFFF'});
			this.add_behavior('scale', {initial: .5, end: .1});
			this.add_behavior('alpha', {initial: 1, end: 0});
			this.add_behavior('gravity', {gravity: 1});
		},
		set_count: function(min, max, interval) {
			this.set('count', { min: min, max: max, interval: interval });
		},
		set_radius: function(min, max) {
			this.set('radius', {min: min, max: max});
		},
		set_life: function(min, max) {
			this.set('life', {min: min, max: max});
		},
		set_velocity: function(rpan_min, rpan_max, thapan_initial, thapan_drift) {
			this.set('velocity', {  
				rpan_min: rpan_min,
				rpan_max: rpan_max,
				thapan_initial: thapan_initial,
				thapan_drift: thapan_drift
			});
		},
		set_image_target: function(src) {
			this.set('image_target', {
				src: src
			});
		},
		add_behavior: function(type, options) {
			this.get('behaviors')[type] = options;
		},
		get_behavior: function(type) {
			return this.get('behaviors')[type];
		},
		clear_behaviors: function() {
			this.set('behaviors', []);
		},
		update_emitter: function() {
			var emitter = this.get('emitter');
			if(!emitter) {
				emitter = new Proton.Emitter();		
				particle_tester.models.renderer.add_emitter(emitter);				
			}
			
			emitter.removeInitializers();
			emitter.removeAllBehaviours();
			emitter.removeAllParticles();
			
			var count = this.get('count');
			emitter.rate = new Proton.Rate(new Proton.Span(count.min, count.max), count.interval);
			
			var radius = this.get('radius');
			emitter.addInitialize(new Proton.Radius(radius.min, radius.max));
			
			var image_target = this.get('image_target');
			if(image_target && $.trim(image_target.src)) {
				emitter.addInitialize(new Proton.ImageTarget(image_target.src));
			}
			
			var life = this.get('life');
			emitter.addInitialize(new Proton.Life(life.min, life.max));
			
			var velocity = this.get('velocity');
			emitter.addInitialize(new Proton.Velocity(new Proton.Span(velocity.rpan_min, velocity.rpan_max), new Proton.Span(velocity.thapan_initial, velocity.thapan_drift, true), 'polar'))
			
			for(behavior in this.get('behaviors')) {
				var value = this.get('behaviors')[behavior];
				switch(behavior) {
					case 'color':
						emitter.addBehaviour(new Proton.Color(value.initial, value.end));
						break;
					case 'scale':
						emitter.addBehaviour(new Proton.Scale(value.initial, value.end));
						break;
					case 'alpha':
						emitter.addBehaviour(new Proton.Alpha(value.initial, value.end));
						break;
					case 'gravity':
						emitter.addBehaviour(new Proton.Gravity(value.gravity, value.life, value.initial));
						break;
				}
			}


			this.set('emitter', emitter);			
			emitter.emit(); /* necessary to change rate */			
			
			//make configurable
			emitter.addInitialize(new Proton.Mass(1));
			//emitter.addBehaviour(new Proton.Color('random', 'random', Infinity, Proton.easeInSine));
			//emitter.addInitialize(new Proton.ImageTarget('/static/images/finch/particle.png'));						
		}
	}),
		
};

var views = {
	Renderer: Backbone.View.extend({
		el: $('#particle-host'),
		initialize: function() {
			this.$el.get(0).width = this.$el.innerWidth();
			this.$el.get(0).height = this.$el.innerHeight();			
		}
	}),
	ParticleSettings: Backbone.View.extend({
		el: $('#particle-config'),
		events: {
			'click #save-particle-settings': 'save_particle_settings',
		},
		initialize: function() {
			$('#color-start, #color-end', this.$el).spectrum({
			    showInitial: true,
			    showInput: true
			});
			$(function() {
				for(i in particle_tester.models.renderer.gl_blend_options) {
					var blend_option = particle_tester.models.renderer.gl_blend_options[i];
					$('#blending-source, #blending-destination').append($("<option></option>").attr('value', blend_option).text(blend_option));
					$('#blending-source')
						.val('SRC_ALPHA')
						.on('change', function() {
							particle_tester.models.renderer.set_src_blend($(this).val());
						});
					$('#blending-destination')
						.val('ONE')
						.on('change', function() {
							particle_tester.models.renderer.set_dst_blend($(this).val());
						});
					
				}
			});
		},
		save_particle_settings: function() {			
			this.model.set_count(
				p.i($('#count-min', this.$el).val()),
				p.i($('#count-max', this.$el).val()),
				p.f($('#spawn-interval', this.$el).val())
			);			
			this.model.set_radius(
				p.f($('#radius-min', this.$el).val()),
				p.f($('#radius-max', this.$el).val())
			);			
			this.model.set_life(
				p.f($('#life-min', this.$el).val()),
				p.f($('#life-max', this.$el).val())
			);			
			this.model.set_velocity(
				p.f($('#rpan-min', this.$el).val()),
				p.f($('#rpan-max', this.$el).val()),
				p.i($('#thapan-initial', this.$el).val()),
				p.i($('#thapan-drift', this.$el).val())
			);
			this.model.set_image_target(
				$('#image-target', this.$el).val()
			);
			
			this.model.clear_behaviors();
			if($('#color-behavior .behavior-toggle').is(':checked')) {
				this.model.add_behavior('color', { 
					initial: $('#color-start', this.$el).spectrum('get').toHexString(),
					end: $('#color-end', this.$el).spectrum('get').toHexString(),
				});
			}
			
			if($('#scale-behavior .behavior-toggle').is(':checked')) {
				this.model.add_behavior('scale', { 
					initial: p.f($('#scale-start', this.$el).val()),
					end: p.f($('#scale-end', this.$el).val()),
				});
			}
			
			if($('#alpha-behavior .behavior-toggle').is(':checked')) {
				this.model.add_behavior('alpha', { 
					initial: p.f($('#alpha-start', this.$el).val()),
					end: p.f($('#alpha-end', this.$el).val()),
				});
			}
			
			if($('#gravity-behavior .behavior-toggle').is(':checked')) {
				this.model.add_behavior('gravity', { 
					gravity: p.f($('#gravity', this.$el).val()),
					life: p.f($('#gravity-life', this.$el).val()),
					easing: p.f($('#gravity-easing', this.$el).val()),
				});
			}
			
			this.model.update_emitter();
		},
		set_model: function(model) {
			this.model = model;
			var count = this.model.get('count');
			$('#count-min', this.$el).val(p.f(count.min));
			$('#count-max', this.$el).val(p.f(count.max));
			$('#spawn-interval', this.$el).val(p.f(count.interval));
			
			var radius = this.model.get('radius');
			$('#radius-min', this.$el).val(p.f(radius.min));
			$('#radius-max', this.$el).val(p.f(radius.max));
			
			var life = this.model.get('life');
			$('#life-min', this.$el).val(p.f(life.min));
			$('#life-max', this.$el).val(p.f(life.max));
			
			var velocity = this.model.get('velocity');
			$('#rpan-min', this.$el).val(p.f(velocity.rpan_min));
			$('#rpan-max', this.$el).val(p.f(velocity.rpan_max));
			$('#thapan-initial', this.$el).val(p.i(velocity.thapan_initial));
			$('#thapan-drift', this.$el).val(p.i(velocity.thapan_drift));
			
			var image_target = this.model.get('image_target');
			if(image_target)
				$('#image-target', this.$el).val(image_target.src);
			
			var color_behavior = this.model.get_behavior('color');
			if(color_behavior) {
				$('#color-behavior .behavior-toggle').prop('checked', true);
				$('#color-start', this.$el).spectrum('set', color_behavior.initial);
				$('#color-end', this.$el).spectrum('set', color_behavior.end);
			}
			
			var scale_behavior = this.model.get_behavior('scale');
			if(color_behavior) {
				$('#scale-behavior .behavior-toggle').prop('checked', true);
				$('#scale-start', this.$el).val(scale_behavior.initial);
				$('#scale-end', this.$el).val(scale_behavior.end);
			}
			
			var alpha_behavior = this.model.get_behavior('alpha');
			if(alpha_behavior) {
				$('#alpha-behavior .behavior-toggle').prop('checked', true);
				$('#alpha-start', this.$el).val(alpha_behavior.initial);
				$('#alpha-end', this.$el).val(alpha_behavior.end);
			}
			
			var gravity_behavior = this.model.get_behavior('gravity');
			if(gravity_behavior) {
				$('#gravity-behavior .behavior-toggle').prop('checked', true);
				$('#gravity', this.$el).val(gravity_behavior.gravity);
				$('#gravity-life', this.$el).val(gravity_behavior.life);
				$('#gravity-easing', this.$el).val(gravity_behavior.easing);
			}
		}		
	}),	
};

var particle_tester = { 
	views: {
		renderer: new views.Renderer(),
		particle_settings: new views.ParticleSettings()
	}	
};

particle_tester.models = {
	renderer: new models.Renderer()	
};

particle_tester.views.renderer.model = particle_tester.models.renderer;
particle_tester.views.particle_settings.model = particle_tester.models.particle_settings;

var p = {
	f : function(string) {
		if(isNaN(string))
			return null;
		
		return parseFloat(string);
	},
	i : function(string) {
		if(isNaN(string))
			return null;
		
		return parseInt(string);
	}
}

$(function() {
	var initial_particle = new models.ParticleSettings();
	particle_tester.views.particle_settings.set_model(initial_particle);
	initial_particle.update_emitter();
});


