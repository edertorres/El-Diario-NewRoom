[![PHP from Packagist](https://img.shields.io/packagist/php-v/bitandblack/helpers)](http://www.php.net)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/a183f5633b5a47eaa0f05409872e732b)](https://www.codacy.com/bb/wirbelwild/helpers/dashboard)
[![Latest Stable Version](https://poser.pugx.org/bitandblack/helpers/v/stable)](https://packagist.org/packages/bitandblack/helpers)
[![Total Downloads](https://poser.pugx.org/bitandblack/helpers/downloads)](https://packagist.org/packages/bitandblack/helpers)
[![License](https://poser.pugx.org/bitandblack/helpers/license)](https://packagist.org/packages/bitandblack/helpers)

# Helpers

Useful methods you may like. 

## Installation 

This library is available for the use with [Composer](https://packagist.org/packages/bitandblack/helpers). Add it to your project by running `$ composer require bitandblack/helpers`. 

## Use 

All methods are defined `static` and can be used without the need of initializing an object. Also most of them are able to handle single input values as well as arrays.

There are useful methods to handle:

-   Arrays
    -   `ArrayHelper::usortMulti` Sorts multidimensional array by their values.
    -   `ArrayHelper::uniqueArray` Uniques an array be a given key.
    -   `ArrayHelper::getIfIsArray` Returns the input if it's an array, otherwise false or a custom value.
    -   `ArrayHelper::getArray` Returns the input as array.
    -   `ArrayHelper::getValueIfKeyExists` Returns the value of an array based on it's key.
    -   `ArrayHelper::recurse` Runs a function on an input, no matter if it's a string or an array.

-   File System
    -   `FileSystemHelper::copyFolder` Copies a whole folder with all of its contents, including subfolders.
    -   `FileSystemHelper::deleteFolder` Deletes a folder with all of its files.

-   Numbers
    -   `NumberHelper::convertNumber` Converts a number into a given format.

-   Requests
    -   `RequestHelper::sortUploadFiles` Sort all uploaded images to a nice array.

-   Strings
    -   `SanitizeHelper::htmlEntities` Returns the input converted by the htmlentities function.
    -   `SanitizeHelper::htmlEntityDecode` Returns the input converted by the html_entity_decode function.
    -   `SanitizeHelper::htmlSpecialChars` Returns the input converted by the htmlspecialchars function.
    -   `StringHelper::stringToBoolean` Converts the input to boolean if possible.
    -   `StringHelper::stringToBooleanAdvanced` Converts the input to boolean if possible and handles also `yes` and `no`.
    -   `StringHelper::stringToInt` Converts the input to int if possible.
    -   `StringHelper::stringToFloat` Converts the input to float if possible.
    -   `StringHelper::stringToNumber` Converts the input to int or float if possible.
    -   `StringHelper::strReplaceMulti` Replaces values in multidimensional arrays.
    -   `StringHelper::booleanToString` Converts `null`, and the booleans `true` and `false` to words.
    -   `StringHelper::mbUcFirst` Converts the first character to uppercase.
    -   `StringHelper::mbStrRev` Reverse a string.

-   URLs
    -   `URLHelper::getContentByURL` Returns the content of a page using allow_url_fopen or curl.
    -   `URLHelper::getScriptURL` Returns the script url parameter.

-   XMLs
    -   `XMLHelper::hasGetOr` Proofs if an attribute exists and returns its content or returns the option parameter instead.
    -   `XMLHelper::hasIsAttribute` Checks if an XML element has an attribute with a given value.
    -   `XMLHelper::loadHTML` Loads HTML safely and ignores errors.

## Help 

If you have any questions, feel free to contact us under `hello@bitandblack.com`.

Further information about Bit&Black can be found under [www.bitandblack.com](https://www.bitandblack.com).
