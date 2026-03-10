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
 * Class NumberHelper
 *
 * @package BitAndBlack\Helpers
 * @see \BitAndBlack\Helpers\Tests\NumberHelperTest
 */
class NumberHelper
{
    /**
     * Converts a number into a given format.
     *
     * @param int|float|string $number The number.
     * @param int $decPlaces           Number of decimal places.
     * @param string $decSep           The character to separate decimals.
     * @param string $thouSep          The character to separate thousands.
     * @return string
     */
    public static function convertNumber(
        $number,
        int $decPlaces = 2,
        string $decSep = '.',
        string $thouSep = ''
    ): string {
        $number = preg_replace('/\s+/', '', (string) $number);
        $numberArr = str_split((string) $number);
        $numberArrRev = array_reverse($numberArr);
        $decPointIsHere = '';

        foreach ($numberArrRev as $key => $value) {
            if (!is_numeric($value) && '' === $decPointIsHere) {
                $decPointIsHere = $key;
            }
        }
        
        if ('' !== $decPointIsHere) {
            $numberArrRev[$decPointIsHere] = '.';
        }
        
        foreach ($numberArrRev as $key => $value) {
            if (!is_numeric($value) && $key > $decPointIsHere) {
                unset($numberArrRev[$key]);
            }
        }
        
        $numberArr = array_reverse($numberArrRev);
        $numberClean = implode('', $numberArr);
        $numberClean = (float) $numberClean;
        
        return number_format($numberClean, $decPlaces, $decSep, $thouSep);
    }
}
