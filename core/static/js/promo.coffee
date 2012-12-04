$ = jQuery

$ ->	
	$('#promo-controls li').click ->
		$this = $(this)
		$promo_line = $('#promo-line')
		$promo_line.animate({
			'left': ($('#promo-frame').width() * $this.index() * -1) + 'px', 
		}, 1000, 'easeOutBack');
		$this.siblings().removeClass('selected')
		$this.addClass('selected')
		