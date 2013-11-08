$ ->
	$('#top-bar .top-bar-links').menu(
		position:	
			my: 'left top',
			at: 'left+1 bottom-1'		
	)
	$('#top-bar .projects').show()
	

isotope_initialized = false
isotope_callback = ->
	if($('body').innerWidth() > 800)
		$('#post-teasers').isotope 	  
			itemSelector: '.post-teaser',
		  	layoutMode: 'fitRows'
		isotope_initialized = true
	else
		if isotope_initialized
	  		$('#post-teasers').isotope('destroy');
	  		isotope_initialized = false
	  	
$(window).load ->
	$('#post-teasers').fadeIn()
	isotope_callback()
	
	  	
$(window).resize -> isotope_callback()		
