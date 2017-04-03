var hoursRemaining = 0;
var minutesRemaining = 0;
var secondsRemaining = 0;
var timeInterval;
var requestInterval;
var syncMistake = 0;	// (+) -> voraus; (-) -> hinterher

function changeThumbnailSmoothly(src) {
	var $sonosThumbnail = $('.sonosThumbnail');

	if ($sonosThumbnail.children().length == 0 || $sonosThumbnail.children().attr("src") != src) {
        if ($sonosThumbnail.children().length == 0) {
            $sonosThumbnail.html("");
            $sonosThumbnail.append("<img>");
			// TODO: Add smoothness
        }
		$sonosThumbnail.children().attr("src", src);
	}
}

function formatTwoDezimals(number) {
	if (number < 10) {
		return "0" + number;
	}
	return number;
}

function formatRemainingString() {
	if (hoursRemaining > 0) {
		return hoursRemaining + ":" + formatTwoDezimals(minutesRemaining) + ":" + formatTwoDezimals(secondsRemaining);
	} else if (minutesRemaining > 0) {
		return minutesRemaining + ":" + formatTwoDezimals(secondsRemaining);
	} else if (secondsRemaining >= 0) {
		return secondsRemaining;
	}
	return "";
}

function tick() {
	if (timeInterval == null) {
		return;
	}

	if ((secondsRemaining <= 0 || secondsRemaining == null) && (hoursRemaining == 0 || hoursRemaining == null) && (minutesRemaining == 0 || minutesRemaining == null)) {
		stopTime();
		stopRequests();
		// Perfectly timed. Too early requests (right in between) DO cause an even longer delay!
		// The maximal synchronisation mistake is 999ms, 25% tolerance (time to let the controller prepare data)
		// secret sync mistake is only weighted to 50% as those generates fastest results
		setTimeout(function() {
			restartRequests();
		}, 1000 + 250 + 500 * syncMistake);
		return;
	}

	secondsRemaining--;

	if (secondsRemaining < 0) {
		if (minutesRemaining != null) {
			if (minutesRemaining <= 0) {
				if (hoursRemaining != null && hoursRemaining > 0) {
					minutesRemaining = 59;
					secondsRemaining = 59;
					hoursRemaining--;
				}
			} else {
				secondsRemaining = 59;
				minutesRemaining--;
			}
		}
	}

	updateClock(formatRemainingString());
}

function updateClock(newString) {
	if ($('.sonosRemaining').html() !== newString) {
		$('.sonosRemaining').html(newString);
	}
}

// Allow a synchronisation-mistake of one second (two seconds in summary)
function areSecondsVeryClose(current, datastream) {
	if (Math.abs(current - datastream) <= 1) {
		if (current - datastream == 1) {
			syncMistake = 1;
		} else if (current - datastream == -1) {
			syncMistake = -1;
		}
		return true;
	}
	if (current == 0 && datastream == 59) {
		syncMistake = 1;
		return true;
	} else if (current == 59 && datastream == 0) {
		syncMistake = -1;
		return true;
	}
	syncMistake = 0;
	return false;
}

function resumeTime() {
	if (timeInterval == null) {
		timeInterval = setInterval(function(){
			tick();
		}, 1000);
	}
}

function stopTime() {
	if (timeInterval != null) {
		clearInterval(timeInterval);
	}

	hoursRemaining = 0;
	minutesRemaining = 0;
	secondsRemaining = 0;
	$('.sonosRemaining').html("");
	timeInterval = null;
}

function stopRequests() {
	if (requestInterval != null) {
		clearInterval(requestInterval);
	}
}

function restartRequests() {
	stopRequests();
	getSonosText();
	requestInterval = setInterval(function() {
		getSonosText();
	}, 5000);
}

function getSonosText() {
	$.ajax({
	   dataType: 'json', url: '../modules/sonos/assets/getDummyParameter.php', success: function(data) {
			if (data.state == "streaming") {
				$('.sonosThumbnail').html("Streaming:<br/>" + data.current);
				$('.sonosCurrent').html("");
				$('.sonosNext').html("");
				stopTime();
			} else if (data.state == "playing") {
				if (data.thumbnail == null) {
					$('.sonosThumbnail').html("");
				} else {
					changeThumbnailSmoothly(data.thumbnail);
				}

				if (data.remaining == null) {
					$('.sonosRemaining').html("");
				} else {
					hoursRemaining = data.remaining.hours;
					minutesRemaining = data.remaining.minutes;
					if (!areSecondsVeryClose(secondsRemaining, data.remaining.seconds)) {
						secondsRemaining = data.remaining.seconds;
					}
					updateClock(formatRemainingString());
					if (data.remaining.seconds >= 0) {
						resumeTime();
					}
				}

				if (data.next == null) {
					$('.sonosNext').html("");
				} else {
					$('.sonosNext').html(data.next);
				}

				$('.sonosCurrent').html(data.current);
			} else if (data.state == "shushed") {
				$('.sonosThumbnail').html("Shushed!");
				$('.sonosCurrent').html("");
				$('.sonosNext').html("");
				stopTime();
			}
			$('.sonosRoom').html(data.room);
	   }
	});
}

$(document).ready(function () {
	restartRequests();
});