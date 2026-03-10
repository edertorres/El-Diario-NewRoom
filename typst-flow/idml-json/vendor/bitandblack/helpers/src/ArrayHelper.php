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
 * Class ArrayHelper
 *
 * @package BitAndBlack\Helpers
 * @see \BitAndBlack\Helpers\Tests\ArrayHelperTest
 */
class ArrayHelper
{
    /**
     * Sorts multidimensional array by their values.
     *
     * @param array<array<string>> $input      The input array to be sorted.
     * @param array<int|string, string> $order The sort order. Those values here are the keys inside the input array.
     * @return array<array<string>> $input
     */
    public static function usortMulti(array $input, array $order): array
    {
        $inputCloned = $input;
        
        usort(
            $inputCloned,
            static function ($itemA, $itemB) use ($order): int {
                $result = [];
            
                foreach ($order as $value) {
                    $value = trim($value);
                    $values = explode(' ', $value);
                    $values = array_map('trim', $values);
                    
                    $field = $values[0] ?? '';
                    $sort = $values[1] ?? '';

                    if (!isset($itemA[$field], $itemB[$field])) {
                        continue;
                    }
            
                    if (0 === strcasecmp($sort, 'desc')) {
                        $temp = $itemA;
                        $itemA = $itemB;
                        $itemB = $temp;
                    }
                    
                    $compare = strcmp($itemA[$field], $itemB[$field]);
        
                    if (is_numeric($itemA[$field]) && is_numeric($itemB[$field])) {
                        $compare = (float) $itemA[$field] - (float) $itemB[$field];
                    }
                    
                    $result[] = $compare;
                }
                
                $r = implode('', $result);
                
                return (int) $r;
            }
        );
        
        return $inputCloned;
    }

    /**
     * Uniques an array be a given key.
     *
     * @param array<array<string>> $input The input array.
     * @param string $key         The key which must appear only once.
     * @return array<array<string>>
     */
    public static function uniqueArray(array $input, string $key): array
    {
        $output = [];
        $count = 0;
        $temp = [];

        foreach ($input as $value) {
            if (!in_array($value[$key], $temp, true)) {
                $temp[$count] = $value[$key];
                $output[$count] = $value;
            }
            
            ++$count;
        }
        
        return $output;
    }

    /**
     * Returns the input if it's an array, otherwise false or a custom value.
     *
     * @return mixed
     */
    public static function getIfIsArray(mixed &$input, mixed $option = false)
    {
        return is_array($input) ? $input : $option;
    }

    /**
     * Returns the input as an array.
     *
     * @template T
     * @param T $input
     * @return array<T>
     */
    public static function getArray($input): array
    {
        return is_array($input) ? $input : [$input];
    }

    /**
     * Returns the value of an array based on it's key.
     *
     * @param array<mixed> $input The input array.
     * @param int|string $key     The key to search for.
     * @param mixed $option       The value if the key doesn't exist.
     * @return mixed
     */
    public static function getValueIfKeyExists(array $input, int|string $key, mixed $option = false): mixed
    {
        return array_key_exists($key, $input)
            ? $input[$key]
            : $option
        ;
    }

    /**
     * Runs a function on an input, no matter if it's a string or an array.
     *
     * @template T
     * @param T $input                         The input. This is mostly an array.
     * @param callable(T, mixed=): T $function The callback function that should handle every entry.
     *                                         The first parameter is the input value, the second
     *                                         parameter is the key and may also be `null`.
     * @return T
     */
    public static function recurse($input, callable $function)
    {
        $inputCopy = $input;

        if (!is_array($inputCopy)) {
            return $function($inputCopy);
        }

        array_walk_recursive(
            $inputCopy,
            static function (&$value, $key) use ($function): void {
                $value = $function($value, $key);
            }
        );

        return $inputCopy;
    }
}
