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

use function mb_strtolower;

/**
 * Class StringHelper
 *
 * @package BitAndBlack\Helpers
 * @see \BitAndBlack\Helpers\Tests\StringHelperTest
 */
class StringHelper
{
    /**
     * Converts the input to boolean if possible.
     *
     * @template T
     * @param T $input
     * @return T
     */
    public static function stringToBoolean($input)
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) {
                $inputConverted = $input;
                
                if (is_string($input)) {
                    $inputConverted = mb_strtolower($input);
                }

                return match ($inputConverted) {
                    'true' => true,
                    'false' => false,
                    'null' => null,
                    default => $input,
                };
            }
        );
    }

    /**
     * Converts the input to boolean if possible and handles also `yes` and `no`.
     *
     * @template T
     * @param T $input
     * @return T
     */
    public static function stringToBooleanAdvanced($input)
    {
        $standard = self::stringToBoolean($input);
        
        if (is_bool($standard) || null === $standard) {
            return $standard;
        }
        
        return ArrayHelper::recurse(
            $standard,
            static function ($input) {
                $inputConverted = $input;

                if (is_string($input)) {
                    $inputConverted = mb_strtolower($input);
                }
                return match ($inputConverted) {
                    'yes' => true,
                    'no' => false,
                    default => $input,
                };
            }
        );
    }

    /**
     * Converts the input to int if possible.
     *
     * @template T
     * @param T $input
     * @return T of int|string|T
     */
    public static function stringToInt($input)
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) {
                if (is_bool($input) || null === $input) {
                    return $input;
                }

                if (!is_numeric($input)) {
                    return $input;
                }

                if (str_contains((string) $input, '.')) {
                    return $input;
                }

                return (int) $input;
            }
        );
    }

    /**
     * Converts the input to float if possible.
     *
     * @template T
     * @param T $input
     * @return T of float|string|T
     */
    public static function stringToFloat($input)
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) {
                if (is_bool($input) || null === $input) {
                    return $input;
                }

                if (!is_numeric($input)) {
                    return $input;
                }

                if (str_contains((string) $input, '.')) {
                    return (float) $input;
                }

                return $input;
            }
        );
    }

    /**
     * Converts the input to int or float if possible.
     *
     * @template T
     * @param T $input
     * @return T of int|float|string|T
     */
    public static function stringToNumber($input)
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) {
                if (is_bool($input) || null === $input) {
                    return $input;
                }

                $int = self::stringToInt($input);

                if (is_int($int)) {
                    return $int;
                }
                
                $float = self::stringToFloat($input);

                if (is_float($float)) {
                    return $float;
                }

                return $input;
            }
        );
    }

    /**
     * Replaces values in multidimensional arrays.
     *
     * @param string|array<mixed> $search  The needle
     * @param string|array<mixed> $replace The replacement
     * @param array<mixed> $subject        The input array
     * @return array<mixed>
     */
    public static function strReplaceMulti($search, $replace, array $subject): array
    {
        $subjectEncoded = json_encode($subject, JSON_THROW_ON_ERROR);
        $subjectReplaced = str_replace($search, $replace, (string) $subjectEncoded);
        $output = json_decode($subjectReplaced, true, 512, JSON_THROW_ON_ERROR);
        
        if (!is_array($output)) {
            return $subject;
        }
        
        return $output;
    }
    
    /**
     * Converts the input to string.
     *
     * @template T
     * @param T $input
     * @return T of bool|string|T
     */
    public static function booleanToString($input)
    {
        return ArrayHelper::recurse(
            $input,
            static function ($input) {
                if (true === $input) {
                    return 'true';
                }

                if (false === $input) {
                    return 'false';
                }

                if (null === $input) {
                    return 'null';
                }

                return $input;
            }
        );
    }

    /**
     * Converts the first character to upper case.
     *
     * @template T
     * @param T $input              The input value.
     * @param string|null $encoding The encoding, for example `UTF-8`.
     *                              If not set, `mb_internal_encoding()` will be called.
     *                              Fallback is `UTF-8`.
     * @return T
     */
    public static function mbUcFirst($input, string|null $encoding = null)
    {
        $encodingNew = $encoding ?? (string) mb_internal_encoding();
        
        if ('' === $encodingNew) {
            $encodingNew = 'UTF-8';
        }

        return ArrayHelper::recurse(
            $input,
            static function ($input) use ($encodingNew) {
                if (!is_string($input)) {
                    return $input;
                }

                $firstCharacter = mb_substr($input, 0, 1);
                $firstCharacter = mb_strtoupper($firstCharacter, $encodingNew);
                $otherCharacters = mb_substr($input, 1);
                return $firstCharacter . $otherCharacters;
            }
        );
    }

    /**
     * Reverse a string.
     *
     * @param string $input
     * @param string|null $encoding
     * @return string
     */
    public static function mbStrRev(string $input, string|null $encoding = null): string
    {
        $chars = mb_str_split($input, 1, $encoding ?: mb_internal_encoding());
        return implode('', array_reverse($chars));
    }
}
