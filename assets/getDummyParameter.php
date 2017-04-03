<?php
// include('../../../config/glancrConfig.php');
include('../vendor/autoload.php');

use duncan3dc\Sonos\Network;

# Use a custom cache instance that can be cleared on demand
$cache = new \Doctrine\Common\Cache\FilesystemCache('/tmp/sonos-cache');
// $cache->deleteAll();	// TODO: Only on startup/demand
$logger = new \Monolog\Logger('sonos');
$logger->pushHandler(new \Monolog\Handler\StreamHandler('php://stdout', \Monolog\Logger::DEBUG));

$sonos = new Network($cache, $logger);

function getRemaining($duration, $position) {
	$remainingHours = intval(substr($duration, 0, 1)) - intval(substr($position, 0, 1));
	$remainingMinutes = intval(substr($duration, 2, 2)) - intval(substr($position, 2, 2));
	$remainingSeconds = intval(substr($duration, 5, 2)) - intval(substr($position, 5, 2));

	while ($remainingSeconds < 0) {
		$remainingMinutes--;
		$remainingSeconds += 60;
	}

	while ($remainingMinutes < 0) {
		$remainingHours--;
		$remainingMinutes += 60;
	}

	if ($remainingHours < 0) {
		return '0';
		// return '-' . getRemaining($position, $duration); // How long has it already been over?
	}

	if ($remainingHours > 0) {
		return array(
			'hours'   => $remainingHours,
			'minutes' => $remainingMinutes,
			'seconds' => $remainingSeconds);
	} else if ($remainingMinutes > 0) {
		return array(
			'minutes' => $remainingMinutes,
			'seconds' => $remainingSeconds);
	} else {
		return array(
			'seconds' => $remainingSeconds);
	}
}

try {
	// $start = microtime();
	$controllers = $sonos->getControllers();
	// $end = microtime();

	if ($controllers != null) {
		foreach($controllers as $controller) {
			$data = array();

			$data['room'] = $controller->room;

			$simpleState = $controller->getState();

			if ($simpleState == $controller::STATE_PLAYING) {
				if (($state = $controller->getStateDetails()) != null && ($state->stream != null || $state->title != '')) {
					if ($state->stream != null) {
						$data['state'] = 'streaming';
						$data['current'] =  $state->stream;
					} else {
						$data['state'] = 'playing';
						$data['thumbnail'] = $state->albumArt;
						$data['current'] = $state->title . ' • ' . $state->artist;
						$data['remaining'] = getRemaining($state->duration, $state->position);
					}

					if ($controller->isUsingQueue()) {
						$queue = $controller->getQueue();

						// Next 4 tracks (if avaliable)
						if (count($nextTracksArray = $queue->getTracks($state->queueNumber + 1, 1)) > 0) {
							$data['next'] = '<hr/>';
							for ($i = 0; count($nextTracksArray) > $i; $i++) {
								$data['next'] .= $nextTracksArray[$i]->title . ' • ' . $nextTracksArray[$i]->artist . (count($nextTracksArray) > $i + 1 ? '<hr/>' : '');
							}
						}
					}
				}
			} else {
				$data['state'] = 'shushed';
			}

			// $data['time'] = 1000 * ($end - $start) . ' msec';

			if (isset($_GET['decode'])) {	// Debug-reasons only
				print_r($data);
			} else {
				echo json_encode($data);
			}
		}
	}
} catch (RuntimeException $e) {
	// empty response - no sonos found
	echo json_encode('');
}