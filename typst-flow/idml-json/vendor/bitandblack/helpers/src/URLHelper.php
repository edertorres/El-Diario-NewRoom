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
 * Useful methods for urls
 * @see \BitAndBlack\Helpers\Tests\URLHelperTest
 */
class URLHelper
{
    /**
     * Returns the content of a page using allow_url_fopen or curl.
     *
     * @return mixed
     */
    public static function getContentByURL(string $url)
    {
        if ((bool) ini_get('allow_url_fopen') === true) {
            $streamOptions = [
                'http' => [
                    'method' => 'GET',
                    'timeout' => 2,
                ],
            ];

            $streamContext = stream_context_create($streamOptions);
            return @file_get_contents($url, false, $streamContext);
        }
        
        if (function_exists('curl_init')) {
            $curl = curl_init();
            curl_setopt($curl, CURLOPT_URL, $url);
            curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
            curl_setopt($curl, CURLOPT_CONNECTTIMEOUT, 2);
            curl_setopt($curl, CURLOPT_TIMEOUT, 2);
            $output = curl_exec($curl);
            curl_close($curl);
            return $output;
        }
        
        return null;
    }

    /**
     * Returns the script url parameter.
     *
     * @return string
     */
    public static function getScriptURL(): string
    {
        $scriptURL = '';

        if (!empty($_SERVER['SCRIPT_URL'])) {
            $scriptURL = $_SERVER['SCRIPT_URL'];
        } elseif (!empty($_SERVER['REDIRECT_URL'])) {
            $scriptURL = $_SERVER['REDIRECT_URL'];
        } elseif (!empty($_SERVER['REQUEST_URI'])) {
            $parseURL = (array) parse_url((string) $_SERVER['REQUEST_URI']);
            $scriptURL = $parseURL['path'] ?? '';
        }

        return $scriptURL;
    }
}
