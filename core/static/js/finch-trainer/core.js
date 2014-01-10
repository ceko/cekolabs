
var finch = {}
finch.game = {	
	round_length: 5,
	statebag: {},
	set_mode: function(mode) {
		finch.game.statebag.mode = mode;
	},		
	start: function() {		
		finch.game.unpause();
		
		if(!finch.game.initialized) {
			finch.game.initialized = true;
			//create all uninitialized models
			finch.game.controls = {
				elements: new models.controls.Elements(),
				elements_helper: new models.controls.Elements({ ignore_keystrokes: true }),
			};		
			finch.game.objective_history = new models.ObjectiveHistory();
			finch.game.round_history = new models.RoundHistory();
			
			finch.game.views.global = new views.Global();
			finch.game.views.elements = new views.Elements({ suppress_fizzle: true, model:finch.game.controls.elements });
			finch.game.views.queued_elements = new views.QueuedElements({ model:finch.game.controls.elements });
			finch.game.views.queued_elements.auto_fadeout = false;
			
			finch.game.views.queued_elements_helper = new views.QueuedElements({ model:finch.game.controls.elements_helper });
			finch.game.views.queued_elements_helper.auto_fadeout = false;
			finch.game.views.queued_elements_helper.helper_mode = true;
			
			finch.game.views.objective_history = new views.ObjectiveHistory({ model:finch.game.objective_history });
			finch.game.views.round_history = new views.RoundHistory({ model:finch.game.round_history });
			
			finch.game.controls.elements.on("element_queue_try", function(model) {
				if(finch.game.loading_next_objective || finch.game.paused)
					return;
				
				finch.game.statebag.objective_keypresses++;
			});
			
			finch.game.controls.elements.on("change:queued_elements", function(model, queued_elements) {			
				if(finch.game.loading_next_objective || finch.game.paused)
					return;
				
				if(finch.game.statebag.mode == 'dequeue') {				
					if(queued_elements.length == 0) {
						var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
						var fumble = finch.game.statebag.objective_keypresses > 3;
						
						finch.game.objective_history.add_history(elapsed_time, finch.game.last_objective, fumble);
						if(finch.game.objective_history.get('history').length < finch.game.round_length)
							finch.game.load_next_objective();
					}
				}else{
					if(finch.game.controls.elements_helper.matches_elements(queued_elements)) {
						var elapsed_time = (new Date()).getTime() - finch.game.last_objective_start_time;
						var fumble = finch.game.statebag.objective_keypresses > 3;
						finch.game.controls.elements.clear_queued_elements();
						
						finch.game.objective_history.add_history(elapsed_time, queued_elements, fumble);
						if(finch.game.objective_history.get('history').length < finch.game.round_length)
							finch.game.load_next_objective();
					}
				}
			});
			finch.game.objective_history.on("change:history", function(model, history) {
				if(history.length === finch.game.round_length) {
					finch.game.pause();
					finch.game.controls.elements.clear_queued_elements();				
					finch.game.views.mode_selection.show();
					finch.game.views.objective_history.transition_to_round_history(function() {
						finch.game.round_history.add_history(finch.game.statebag.mode, history);
						finch.game.round_history.save_history(finch.game.statebag.mode, history);
						finch.game.stats_overview.update();
						finch.game.objective_history.clear();
					});
					finch.game.views.queued_elements.hide()
					finch.game.views.queued_elements_helper.hide()
				}
			});
		}
	},
	pause: function() {
		finch.game.paused = true;
	},
	unpause: function() {
		finch.game.paused = false;
	},
	views: {},
	controls: {},
	load_next_objective: function() {		
		finch.game.loading_next_objective = true;
		finch.game.statebag.objective_keypresses = 0;
		finch.game.last_objective_start_time = (new Date()).getTime();
		if(finch.game.statebag.mode === 'dequeue') {
			finch.game.controls.elements.queue_random_elements();
		}else{
			finch.game.views.queued_elements.render();
			finch.game.views.queued_elements_helper.render();
			finch.game.controls.elements_helper.queue_random_elements();
		}
		finch.game.last_objective = finch.game.controls.elements.get('queued_elements').slice(0);
		finch.game.loading_next_objective = false;
	}
}

/** backbone models **/

/** magicka button combination controls **/
var models = { controls: {} };

models.StatsOverview = Backbone.Model.extend({
	initialize: function() {
		this.set({
			games_played: 0,
			fumbles: 0,
			total_objectives: 0,
			fumble_percentage: 0,
			best_time: 0,
			worst_time: 0,
			average_time: 0
		});
	},
	update: function() {
		var round_history = finch.game.round_history.get('history');
		var games_played = 0;
		var total_objectives = 0;
		var best_time = 999999;
		var worst_time = 0;
		var average_time = 0;

		var fumbles = 0;
		var fumble_percentage = 0;
		
		for(var i=0;i<round_history.length;i++) {
			games_played++;
						
			for(var j=0;j<round_history[i].history.length;j++) {				
				best_time = Math.min(best_time, round_history[i].history[j].time_to_complete);
				worst_time = Math.max(worst_time, round_history[i].history[j].time_to_complete);
				average_time = (average_time * total_objectives + round_history[i].history[j].time_to_complete) / (total_objectives+1);
				if(round_history[i].history[j].fumble) {
					fumbles++;
				}
				total_objectives++;
			}
		}
		
		this.set({
			games_played: games_played,
			fumbles: fumbles,
			total_objectives: total_objectives,
			fumble_percentage: Math.floor(fumbles/total_objectives*100),
			best_time: best_time,
			worst_time: worst_time,
			average_time: Math.floor(average_time)
		});
		this.trigger('statistics_updated');
	}
});

models.controls.Elements = Backbone.Model.extend({
	suppress_fizzle: false,
	ignore_keystrokes: false,
	initialize: function() {
		this.set({
			queued_elements: [],	
			pressed_elements: [],
		});
		this.keybindings = {
			'q': 'water',
			'w': 'life',
			'e': 'shield',
			'r': 'cold',
			'a': 'lightning',
			's': 'arcane',
			'd': 'earth',
			'f': 'fire'
		};
		this.incompatibility_list = [			
			['life', 'arcane'],
			['shield', 'shield'],
			['cold', 'fire'],
			['lightning', 'earth'],
			['lightning', 'water']
		];
	},
	clear_queued_elements: function() {
		this.set('queued_elements', []);
	},
	queue_random_elements: function() {
		this.suppress_fizzle = true;
		this.clear_queued_elements();		
		while(this.get('queued_elements').length < 3) {
			var keybinding_index = Math.floor(Math.random()*8);
			var cnt = 0;
			var proposed_keypress = null;
			for(key in this.keybindings) {
				if(this.keybindings.hasOwnProperty(key)) {
					if(cnt == keybinding_index) {
						proposed_keypress = key
						break;
					}
						
					cnt++;
				}			
			}
			
			this.handle_keyup(proposed_keypress);
		}
		this.suppress_fizzle = false;
	},
	matches_elements: function(elements) {
		var element_arr1 = this.get('queued_elements').slice(0);
		var element_arr2 = elements.slice(0);
		var el1;
		while(el1 = element_arr1.pop()) {
			var idx = element_arr2.indexOf(el1);
			if(idx > -1) {
				element_arr2.splice(idx,1);
			}else{
				return false;
			}
		}
		
		return element_arr1.length == 0 & element_arr2.length == 0;
	},
	handle_keydown: function(key) {
		var element = this.keybindings[key];
		var pressed_elements = this.get('pressed_elements');
		if(element) {
			pressed_elements[element] = true;
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
		}
	},
	handle_keyup: function(key) {
		var element = this.keybindings[key];		
		if(element) {
			this.trigger('element_queue_try');
			if(!this.requested_element_incompatible(element)) {			
				var queued_elements = this.get('queued_elements');
				if(queued_elements.length < 3) {
					queued_elements.push(element);
					this.set('queued_elements', queued_elements);
					this.trigger('change:queued_elements', this, queued_elements);
				}								
			}
			
			var pressed_elements = this.get('pressed_elements');
			delete pressed_elements[element];
			this.set('pressed_elements', pressed_elements);
			this.trigger('change:pressed_elements', this, pressed_elements);
		}
	},
	requested_element_incompatible: function(element) {
		var queued_elements = this.get('queued_elements');		
		//iterate through incompatibility list
		for(i=0;i<this.incompatibility_list.length;i++) {
			var check_set = this.incompatibility_list[i];
			//iterate through specific incompatibility
			for(j=0;j<check_set.length;j++) {
				//this element is in the list, check queued elements from last to first
				if(check_set[j] == element) {
					var found_at = j; //skip this when checking queued.
					for(k=0;k<check_set.length;k++) {
						if(k != found_at) {
							var incompatibility_index = queued_elements.lastIndexOf(check_set[k]);
							if(incompatibility_index !== -1) {
								if(!this.suppress_fizzle)
									this.trigger('element_fizzle', this, incompatibility_index, element);
								
								queued_elements.splice(incompatibility_index, 1);
								this.set('queued_elements', queued_elements);
								this.trigger('change:queued_elements', this, queued_elements);
								return true;
							}
						}
					}					
				}
			}
		}
	}
});

models.RoundHistory = Backbone.Model.extend({
	initialize: function() {
		this.set({
			history: [],
		});
	},
	add_history: function(round_label, round_history) {		
		var history = this.get('history');
		var total_time = 0;
		for(var i=0;i<round_history.length;i++) {
			total_time += round_history[i].time_to_complete;
		}
		history.push({ 
			label: round_label,
			history: round_history,
			average_time: Math.floor(total_time / round_history.length)
		});
		this.set('history', history);
		this.trigger('change:history', this, history);
	},
	save_history: function(round_label, round_history) {
		$.ajax({
			url: '/trainer-save-history',
			type: 'POST',
			data: { label: JSON.stringify(round_label), history: JSON.stringify(round_history) }
		});		
	}
});

models.ObjectiveHistory = Backbone.Model.extend({	
	initialize: function() {
		this.set({
			history: [],
		});
	},
	clear: function() {
		this.set('history', []);
	},
	add_history: function(time_to_complete, element_queue, fumble) {		
		var history = this.get('history');		
		history.push({ 
			time_to_complete: time_to_complete,
			element_queue: element_queue,
			fumble: fumble
		});
		this.trigger('change:history', this, history);
	}
});

/** end backbone models **/

/** views **/
var views = {};

views.RoundHistory = Backbone.View.extend({
		
	el: $('#round-history-slot'),
	
	initialize: function() {	
		this.model.on("change:history", this.handle_history_change.bind(this));	
		this.already_rendered = false;
	},
	
	handle_history_change: function(model, history) {
		this.render();		
	},
	
	render: function() {
		var history = this.model.get('history');
		
		this.$el.prepend($("#round-history-template").render({ history: history[history.length-1], game_number: history.length }));		
		
		this.$el.find('.game:first').hide().slideDown();
		this.$el.find('.game:not(:first)').find('.rows').slideUp('fast');
		this.$el.find('.game:first .header').on('click', function() {
			$(this).closest('.game').find('.rows').slideToggle();
		});
		
		return this;
	}
});

views.StatsOverview = Backbone.View.extend({
	el: $('#stats-overview-slot'),
	
	initialize: function() {	
		this.model.on("statistics_updated", this.handle_statistics_updated.bind(this));
	},
	
	handle_statistics_updated: function() {
		this.render();
	},
	
	render: function() {
		this.$el.html($("#stats-overview-template").render({ model: this.model }));
	}	
});

views.ObjectiveHistory = Backbone.View.extend({
	
	tagName: 'div',
	id: 'objective-history',
	
	initialize: function() {	
		this.model.on("change:history", this.handle_history_change.bind(this));	
		this.already_rendered = false;
	},
	
	handle_history_change: function(model, history) {
		this.render();		
	},
	
	transition_to_round_history: function(callback) {
		var $target = finch.game.views.round_history.$el;
		var _this = this;
		this.$el.animate({
			top: $target.position().top,
			left: $target.position().left,
			opacity: 0,
		}, function() {
			if(callback) callback();
			_this.already_rendered = false;
			$(this).hide();
		});		
	},
	
	hide: function() {
		this.$el.hide();
	},
	
	render: function() {				
		var history = this.model.get('history');		
		this.$el.html($("#history-template").render({ history: history.slice(0).reverse() }));
		this.$el.show().find(".history:first").hide().fadeIn();	
		
		//first time rendering position it in the middle of the playing field.
		if(!this.already_rendered) {
			this.already_rendered = true;		
			var $battlefield = $('#battlefield');
			$battlefield.append(this.$el);
			//position it in the middle of the battlefield by default, it can get moved though
			this.$el.css({
				top: ($battlefield.outerHeight() / 2 - this.$el.outerHeight() / 2) - 10,
				left: $battlefield.outerWidth() / 2 - this.$el.outerWidth() / 2 - 140,
			});
			this.$el.css({ opacity: 100 });
			this.$el.show();
		}
		
		return this;		
	}
	
});

views.Global = Backbone.View.extend({
	el: $('body'),
	events: {
		'keydown': 'handle_keydown',
		'keyup': 'handle_keyup'
	},
	initialize: function() {
		this.$el.disableSelection();
	},
	handle_keydown: function(evt) {
		if(finch.game.paused) return;
		
		var key = String.fromCharCode(evt.which).toLowerCase();
		finch.game.controls.elements.handle_keydown(key);				
	},
	
	handle_keyup: function(evt) {
		if(finch.game.paused) return;
		
		var key = String.fromCharCode(evt.which).toLowerCase();
		finch.game.controls.elements.handle_keyup(key);
	},
});

views.ModeSelection = Backbone.View.extend({
	el: $('#mode-selection'),
	events: {
		'click .dequeue-mode': 'start_dequeue_game',
		'click .queue-mode': 'start_queue_game',
		'change #round-length': 'change_round_length'		
	},
	
	initialize: function() {
		$('#round-length').val(finch.game.round_length);
		$('#cancel-game').click(this.cancel_game.bind(this));
		this.countdown_timer = null;
	},
	
	change_round_length: function() {
		finch.game.round_length = parseInt($('#round-length').val());
	},
	
	cancel_game: function() {
		finch.game.pause();
		if(finch.game.controls.elements)
			finch.game.controls.elements.clear_queued_elements();				
		finch.game.views.mode_selection.show();	
		if(finch.game.objective_history) {
			finch.game.objective_history.clear();
			finch.game.views.objective_history.hide();
		}
		if(finch.game.views.queued_elements)
			finch.game.views.queued_elements.hide()
		if(finch.game.views.queued_elements_helper)
			finch.game.views.queued_elements_helper.hide()
		this.countdown_timer = clearTimeout(this.countdown_timer);
		$('.countdown').remove();
	},
	
	start_queue_game: function() {
		var callback = function() {
			finch.game.set_mode('queue');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.show()
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.$el.fadeOut('fast');				
		this.set_game_mode_text('Queue Shown Elements');
	},
	
	start_dequeue_game: function() {
		var callback = function() {
			finch.game.set_mode('dequeue');
			finch.game.start();
			finch.game.load_next_objective();
			finch.game.views.queued_elements.show()
		};
		
		$('#cancel-game').show();
		this.show_countdown(callback.bind(this));
		this.$el.fadeOut('fast');		
		this.set_game_mode_text('Cancel Queued Elements');
	},
	
	show_countdown: function(callback) {
		var $countdown_original = $('<div class="countdown">3</div>');
		$("#battlefield").append($countdown_original);
		$countdown_original.css({
			'position': 'absolute',
			'top': $('#battlefield').height()/2 - $countdown_original.height()/2,
			'left': ($('#battlefield').width()-$('#round-history-slot').width())/2 - $countdown_original.width()/2,
			'display': 'none'
		});
				
		this.countdown_timer = clearTimeout(this.countdown_timer);
		var _this = this;
		var advance_countdown = function(cnt) {			
			var $countdown = $countdown_original.clone();
			$('#battlefield').append($countdown);
			$countdown.text(cnt).show();
			$countdown.effect('puff', {percent:300}, 500, function() {				
				$countdown.remove();
			});
			
			this.countdown_timer = setTimeout(function() {
				if(cnt==1) {
					if(_this.countdown_timer) callback();
					$countdown_original.remove();
				}else{
					if(_this.countdown_timer) advance_countdown(cnt-1);
				}
			}, 1000);
			
		};
		
		this.countdown_timer = setTimeout(function() { advance_countdown(3); }, 1);
	},
	
	set_game_mode_text: function(text) {
		$('#game-mode-display').text(text);
	},
	
	show: function() {
		$('#cancel-game').hide();
		this.$el.fadeIn('fast');		
		this.$el.css({			
			'top': $('#game-title-slot').height()/2 + $('#battlefield').innerHeight()/2 - this.$el.outerHeight()/2,
			'left': ($('#battlefield').width()-$('#round-history-slot').width())/2 - this.$el.width()/2			
		});
		this.set_game_mode_text('None Selected');
	}
});

views.Elements = Backbone.View.extend({
	el: $('#elements-controls'),
				
	initialize: function() {
		this.model.on("change:pressed_elements", this.handle_pressed_elements.bind(this));		
	},
	
	handle_pressed_elements: function(model, pressed_elements) {		
		this.$el.find('.pressed').removeClass('pressed');
		var _this = this;
		for(var element in pressed_elements) {		
			this.$el.find('.' + element).addClass('pressed');
		}
	},
	
});

views.QueuedElements = Backbone.View.extend({

	tagName: 'div',	
	className: 'elements element-queue',
	hide_timeout: null,
	auto_fadeout: true,
	helper_mode: false,
	
	initialize: function() {	
		this.model.on("change:queued_elements", this.handle_queued_elements.bind(this));
		this.model.on("element_fizzle", this.handle_element_fizzle.bind(this));
		this.already_rendered = false;
	},
	
	handle_queued_elements: function(model, queued_elements) {
		this.render();
		//add unknown elements
	},
	
	handle_element_fizzle: function(model, element_index, requested_element) {
		var $fizzled_element = $(this.$el.find('div').get(element_index));
		var $clone = $("<div class='elements'></div>");
		$clone.append($fizzled_element.clone());
		$clone.css({
			position: 'absolute',
			marginLeft: 0, 
			marginTop: 0, 
			top: $fizzled_element.offset().top,
			left: $fizzled_element.offset().left
		});
		$clone.addClass('fizzling').remove().appendTo('body');
		var $requested = $clone.clone();
		$clone.animate({
				top: '-=50',
				opacity: '0',
			}, 500, 'linear', function() {
				$(this).remove();
			});
		$requested.find('div').attr('class', requested_element + ' fizzling');
		$requested.appendTo('body').effect('shake', 400, function() {
			$(this).remove();
		});
		
	},
	
	hide: function() {
		clearTimeout(this.hide_timeout);
		this.$el.fadeOut();
	},
	
	show: function() {
		this.$el.show();
	},
	
	render: function() {				
		var queued_elements = this.model.get('queued_elements');
		var conditioned_queued_elements = [];
		for(var index in queued_elements) {		
			conditioned_queued_elements.push({ name: queued_elements[index] });
		}
		for(i=0;i<3-queued_elements.length;i++) {
			conditioned_queued_elements.push({ name: 'unknown'});
		}
		this.$el.html($("#element-queue-template").render({ queued_elements: conditioned_queued_elements }));
		if(this.helper_mode) {
			this.$el.addClass('helper-mode');
		}
		
		//first time rendering position it in the middle of the playing field.
		if(!this.already_rendered) {
			this.already_rendered = true;		
			var $battlefield = $('#battlefield');
			$battlefield.append(this.$el);
			//position it in the middle of the battlefield by default, it can get moved though
			this.$el.css({
				top: $battlefield.outerHeight() / 2 - this.$el.outerHeight() / 2 - 100 - (this.helper_mode ? 50 : 0),
				left: $battlefield.outerWidth() / 2 - this.$el.outerWidth() / 2 - 7 /** 15 pixels padding **/ - 140 /** history width **/,
			});
		}
		if(!queued_elements.length) {
			if(this.auto_fadeout) {
				this.hide_timeout = setTimeout((function() { this.$el.fadeOut(); }).bind(this), 5000 );
			}
		}else{
			this.$el.show();
			clearTimeout(this.hide_timeout);
		}
		return this;
		
	}


});
/** end views **/

/** csrf support **/

$(document).ajaxSend(function(event, xhr, settings) {
    function getCookie(name) {
        var cookieValue = null;
        if (document.cookie && document.cookie != '') {
            var cookies = document.cookie.split(';');
            for (var i = 0; i < cookies.length; i++) {
                var cookie = jQuery.trim(cookies[i]);
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) == (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
    function sameOrigin(url) {
        // url could be relative or scheme relative or absolute
        var host = document.location.host; // host + port
        var protocol = document.location.protocol;
        var sr_origin = '//' + host;
        var origin = protocol + sr_origin;
        // Allow absolute or scheme relative URLs to same origin
        return (url == origin || url.slice(0, origin.length + 1) == origin + '/') ||
            (url == sr_origin || url.slice(0, sr_origin.length + 1) == sr_origin + '/') ||
            // or any other URL that isn't scheme relative or absolute i.e relative.
            !(/^(\/\/|http:|https:).*/.test(url));
    }
    function safeMethod(method) {
        return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
    }

    if (!safeMethod(settings.type) && sameOrigin(settings.url)) {
        xhr.setRequestHeader("X-CSRFToken", getCookie('csrftoken'));
    }
});

/** end csrf support **/

finch.game.views.mode_selection = new views.ModeSelection();
finch.game.stats_overview = new models.StatsOverview();
finch.game.views.stats_overview = new views.StatsOverview({ model: finch.game.stats_overview });
finch.game.views.stats_overview.render();
finch.game.views.mode_selection.show();