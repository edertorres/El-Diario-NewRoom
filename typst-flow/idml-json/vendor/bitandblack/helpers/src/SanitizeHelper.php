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

/**
 * Useful methods for sanitizing
 * @see \BitAndBlack\Helpers\Tests\SanitizeHelperTest
 */
class SanitizeHelper
{
    /**
     * Returns the input converted by the htmlentities function.
     *
     * @template T
     * @param T $input
     * @return T
     */
    public static function htmlEntities($input, string $charset = 'UTF-8')
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) use ($charset) {
                if (!is_string($input)) {
                    return $input;
                }

                return htmlentities($input, ENT_QUOTES, $charset);
            }
        );
    }

    /**
     * Returns the input converted by the html_entity_decode function.
     *
     * @template T
     * @param T $input
     * @return T
     */
    public static function htmlEntityDecode($input, string $charset = 'UTF-8')
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) use ($charset) {
                if (!is_string($input)) {
                    return $input;
                }

                return html_entity_decode($input, ENT_QUOTES, $charset);
            }
        );
    }

    /**
     * Returns the input converted by the htmlspecialchars function.
     *
     * @template T
     * @param T $input
     * @return T
     */
    public static function htmlSpecialChars($input, string $charset = 'UTF-8')
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) use ($charset) {
                if (!is_string($input)) {
                    return $input;
                }

                return htmlspecialchars($input, ENT_QUOTES, $charset);
            }
        );
    }
}
