<?php

/**
 * Bit&Black Helpers - Useful methods for PHP you may like.
 *
 * @author Tobias Köngeter
 * @copyright Copyright © Bit&Black
 * @link https://www.bitandblack.com
 * @license MIT
 */

namespace BitAndBlack\Helpers;

use DOMDocument;
use DOMElement;

/**
 * Class XMLHelper
 *
 * @package BitAndBlack\Helpers
 * @see \BitAndBlack\Helpers\Tests\XMLHelperTest
 */
class XMLHelper
{
    /**
     * Proofs if an attribute exists and returns its content or returns the option parameter instead.
     *
     * @template T
     * @param T $option
     * @return string|false|T
     */
    public static function hasGetOr(DOMElement $element, string $attribute, $option = false)
    {
        return $element->hasAttribute($attribute)
            ? $element->getAttribute($attribute)
            : $option
        ;
    }

    /**
     * Checks if an XML element has an attribute with a given value.
     *
     * @return boolean
     */
    public static function hasIsAttribute(DOMElement $element, string $attribute, mixed $value): bool
    {
        return self::hasGetOr($element, $attribute, null) === $value;
    }
    
    /**
     * Loads HTML safely and ignores errors.
     *
     * @return void
     */
    public static function loadHTML(DOMDocument $domDocument, string $input): void
    {
        $useInternalErrors = libxml_use_internal_errors(true);

        $inputConverted = mb_encode_numericentity($input, [0x80, 0x10fffff, 0, 0x1fffff], mb_internal_encoding());

        $domDocument->loadHTML(
            $inputConverted,
            LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
        );
        
        libxml_clear_errors();
        libxml_use_internal_errors($useInternalErrors);
    }
}
