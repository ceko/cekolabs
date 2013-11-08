$ = jQuery

$ ->	
	advance_interval = null
	ticks_before_slide = 5
	tick_counter = 0
	
	$('#promo-controls li:first').addClass('selected')
	$('#promo-controls li').click ->
		clearInterval(advance_interval)
		$('#promo-slideshow .progress-indicator').fadeOut('slow');
		$this = $(this)
		$promo_line = $('#promo-line')
		advance_slideshow($this.index())		
	
	advance_slideshow = (index) ->
		$selected = $("#promo-controls li:nth-child(#{index+1})")		
		if(index == undefined)			 
			index = $selected.index()
						
		$selected.siblings().removeClass('selected')
		$selected.addClass('selected')	
			
		$promo_line = $('#promo-line')
		$promo_line.stop().animate({
			'left': ($('#promo-frame').width() * index * -1) + 'px', 
		}, 1000, 'easeOutBack')
		
	advance_callback = ->
		tick_counter++
						
		if ticks_before_slide < tick_counter		
			$selected = $('#promo-controls li').filter -> 
				return $(this).hasClass('selected') 
			if($selected.next().length)
				advance_slideshow($selected.next().index())
			else
				advance_slideshow(0)
			$('#promo-slideshow .progress-indicator .fill').stop().css({width:'0%'})
			tick_counter = 1
		
		animation_timer = 3000		
		$('#promo-slideshow .progress-indicator .fill').animate({
			width: "#{tick_counter/ticks_before_slide*100}%"
		}, animation_timer, 'linear')
			
	advance_callback()
	advance_interval = setInterval advance_callback, 3000
	
	promo_callback = ->
		image_ratio = 315/710 #size of a feature image
		body_width = $('body').width()
		if(body_width <= 1000)
			$('#promo-wrap .image-promo').css({'height' : (body_width * image_ratio) + 'px', 'width' : body_width})
			$('#promo-wrap .image-promo img').css({'height' : '100%'})
		else 
			$('#promo-wrap .image-promo').css({'height' : 'inherit', 'width' :'inherit'})
			$('#promo-wrap .image-promo img').css({'height' : ''})
		
		#reposition the slide, it may have drifted
		$selected = $('#promo-controls li').filter -> 
			return $(this).hasClass('selected') 
		advance_slideshow($selected.index())
		
	$(window).resize -> promo_callback()
	if($('body').innerWidth() <= 1000)
		promo_callback()