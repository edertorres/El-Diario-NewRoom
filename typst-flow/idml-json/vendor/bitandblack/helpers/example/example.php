<?php

use BitAndBlack\Helpers\SanitizeHelper;

require '../vendor/autoload.php';

$input = [
    '<b>Hello world!</b>',
    'Gimme some Jägermeister',
];

/**
 * Dumpes:
 *
 * array(2) {
 *   [0]=>
 *   string(31) "&lt;b&gt;Hello world!&lt;/b&gt;"
 *   [1]=>
 *   string(28) "Gimme some J&auml;germeister"
 * }
 */
var_dump(SanitizeHelper::htmlEntities($input));
