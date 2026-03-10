<?php

namespace BitAndBlack\Composer\Exception;

use BitAndBlack\Composer\Exception;

/**
 * Class VendorNotFoundException
 *
 * @package BitAndBlack\Composer\Exception
 */
class VendorNotFoundException extends Exception
{
    /**
     * VendorNotFoundException constructor.
     */
    public function __construct()
    {
        parent::__construct(
            'Couldn\'t find vendor folder. Maybe you need to run "$ composer install" at first'
        );
    }
}
