[![PHP from Packagist](https://img.shields.io/packagist/php-v/bitandblack/composer-helper)](http://www.php.net)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/3c4a917dc4054619b7461a454c69e903)](https://www.codacy.com/bb/wirbelwild/composer-helper/dashboard) 
[![Latest Stable Version](https://poser.pugx.org/bitandblack/composer-helper/v/stable)](https://packagist.org/packages/bitandblack/composer-helper)
[![Total Downloads](https://poser.pugx.org/bitandblack/composer-helper/downloads)](https://packagist.org/packages/bitandblack/composer-helper)
[![License](https://poser.pugx.org/bitandblack/composer-helper/license)](https://packagist.org/packages/bitandblack/composer-helper)

# Composer Helper

This library provides useful functions for Composer. 

## Installation 

This library is made for the use with [Composer](https://packagist.org/packages/bitandblack/composer-helper). Add it to your project by running `$ composer require bitandblack/composer-helper`.

## Usage 

### Path to vendor folder

Get the path to your vendor folder by calling: 

````php
<?php

use BitAndBlack\Composer\VendorPath;

$vendorFolder = (string) new VendorPath();
````

This works also when your vendor folder has a different name.

### Class existence 

Check if a class exists by calling `Composer::classExists()`. This is a replacement for `class_exists()` which may not work with Composer.

## Help 

If you have any questions feel free to contact us under `hello@bitandblack.com`.

Further information about Bit&Black can be found under [www.bitandblack.com](https://www.bitandblack.com).