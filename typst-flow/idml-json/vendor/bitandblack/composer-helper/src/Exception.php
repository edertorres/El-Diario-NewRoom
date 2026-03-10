<?php

namespace BitAndBlack\Composer;

/**
 * Class Exception
 *
 * @package BitAndBlack\Composer
 */
class Exception extends \Exception
{
    /**
     * Exception constructor.
     *
     * @param string $message
     */
    public function __construct($message)
    {
        parent::__construct($message);
    }
}
