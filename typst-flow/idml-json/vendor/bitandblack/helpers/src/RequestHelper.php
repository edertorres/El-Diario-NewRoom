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
 * Class RequestHelper
 *
 * @package BitAndBlack\Helpers
 * @see \BitAndBlack\Helpers\Tests\RequestHelperTest
 */
class RequestHelper
{
    /**
     * Sorts all uploaded images to a nice array, sorted by their names.
     *
     * @param array<string, array<string|int, string|int>> $input The file list. This is mostly the array of $_FILES,
     *                                                            expect when you have a namespace,
     *                                                            then it should be $_FILES['namespace'].
     *
     *                                                            The array has the following structure:
     *
     *                                                            array{
     *                                                                'name': array<string, string>,
     *                                                                'type': array<string, string>,
     *                                                                'tmp_name': array<string, string>,
     *                                                                'error': array<string, int>,
     *                                                                'size': array<string, int>
     *                                                            }
     *
     * @return array<int|string, array<string, string|int>>       The files list sorted by files. The structure is:
     *
     *                                                            array<
     *                                                                int|string,
     *                                                                array{
     *                                                                    'name': string,
     *                                                                    'type': string,
     *                                                                    'tmp_name': string,
     *                                                                    'error': int,
     *                                                                    'size': int
     *                                                                }
     *                                                            >
     */
    public static function sortUploadFiles(array $input): array
    {
        $output = [];
        
        foreach ($input as $key => $files) {
            foreach ($files as $id => $value) {
                $output[$id][$key] = $value;
            }
        }
        
        return $output;
    }
}
